import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SyncEngine } from './SyncEngine';
import type { SupabaseClientLike, SyncState } from './types';
import type { EventStore } from '../events/EventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';

const DEFAULT_OPTIONS = {
  visibilityIdleThresholdMs: 5 * 60 * 1000,
};

const FALLBACK_INITIAL_RESTORE_SAFETY_TIMEOUT_MS = 8000;
const LONG_WAIT_COPY_THRESHOLD_MS = 3000;

export function resolveInitialRestoreSafetyTimeoutMs(rawEnvValue: string | undefined): number {
  const parsed = Number(rawEnvValue);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : FALLBACK_INITIAL_RESTORE_SAFETY_TIMEOUT_MS;
}

const DEFAULT_INITIAL_RESTORE_SAFETY_TIMEOUT_MS = resolveInitialRestoreSafetyTimeoutMs(
  import.meta.env.VITE_INITIAL_RESTORE_TIMEOUT_MS
);

function initialSyncState(): SyncState {
  return {
    status: 'idle',
    lastSyncedAt: null,
    lastError: null,
    pendingCount: 0,
    initialRestorePending: true,
  };
}

function BootMark() {
  return (
    <svg className="boot-mark-svg" viewBox="0 0 32 32" width="56" height="56" aria-hidden="true">
      <rect width="32" height="32" rx="6" className="boot-mark-bg" />
      <path d="M8 10h16" className="boot-mark-line boot-mark-line-1" />
      <path d="M8 16h12" className="boot-mark-line boot-mark-line-2" />
      <path d="M8 22h8" className="boot-mark-line boot-mark-line-3" />
      <circle cx="24" cy="22" r="3" className="boot-mark-dot" />
    </svg>
  );
}

function BootScreen({ longWait }: { longWait: boolean }) {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <div className="boot-mark-wrap">
        <BootMark />
      </div>
      <div className="boot-wordmark">Study Tracker</div>
      <div className="boot-caption">
        {longWait ? 'Still bringing things over' : 'Setting up this device'}
      </div>
      <div className="boot-subcaption">
        {longWait
          ? 'Larger histories take a little longer. Hang tight.'
          : 'Bringing over your study history - this only happens once.'}
      </div>
    </div>
  );
}

interface SyncContextValue {
  syncState: SyncState;
  logEvent: (kind: string, payload: Record<string, unknown>, createdAt?: string) => Promise<number>;
  forceSyncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

function getOrCreateClientId(): string {
  const key = 'study_tracker_client_id';
  let clientId = localStorage.getItem(key);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(key, clientId);
  }
  return clientId;
}

interface SyncProviderProps {
  children: ReactNode;
  supabase: SupabaseClientLike;
  supabaseUrl?: string;
  userId: string;
  eventStore: EventStore;
  initialRestoreSafetyTimeoutMs?: number;
}

export function SyncProvider({
  children,
  supabase,
  supabaseUrl,
  userId,
  eventStore,
  initialRestoreSafetyTimeoutMs = DEFAULT_INITIAL_RESTORE_SAFETY_TIMEOUT_MS,
}: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [isOnline, setIsOnline] = useState(true);
  const [initialRestoreTimedOut, setInitialRestoreTimedOut] = useState(false);
  const [showLongWaitCopy, setShowLongWaitCopy] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const engineRef = useRef<SyncEngine | null>(null);
  const engineGenerationRef = useRef(0);
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const lastUserIdRef = useRef<string | null>(null);
  const lastEventStoreRef = useRef<EventStore | null>(null);
  const durabilityRef = useRef<DurabilityHooks | null>(null);

  useEffect(() => {
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    }

    if (lastEventStoreRef.current && lastEventStoreRef.current !== eventStore) {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    }

    setInitialRestoreTimedOut(false);
    setShowLongWaitCopy(false);
    setSyncState(initialSyncState());

    const sendBeaconUrl = supabaseUrl ? `${supabaseUrl}/rest/v1/events` : '';
    const engineGeneration = engineGenerationRef.current + 1;
    engineGenerationRef.current = engineGeneration;

    const engine = new SyncEngine(
      supabase,
      eventStore,
      userId,
      clientIdRef.current,
      (newState) => {
        if (engineGenerationRef.current === engineGeneration) {
          setSyncState(newState);
        }
      },
      sendBeaconUrl,
      DEFAULT_OPTIONS
    );

    engineRef.current = engine;
    lastUserIdRef.current = userId;
    lastEventStoreRef.current = eventStore;

    engine.restoreFromCloud().catch(() => {});

    const safetyTimeoutId = setTimeout(
      () => setInitialRestoreTimedOut(true),
      initialRestoreSafetyTimeoutMs
    );
    const longWaitCopyTimeoutId = setTimeout(
      () => setShowLongWaitCopy(true),
      LONG_WAIT_COPY_THRESHOLD_MS
    );

    return () => {
      if (engineGenerationRef.current === engineGeneration) {
        engineGenerationRef.current += 1;
      }
      engine.destroy();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      clearTimeout(safetyTimeoutId);
      clearTimeout(longWaitCopyTimeoutId);
    };
  }, [supabase, userId, eventStore, initialRestoreSafetyTimeoutMs]);

  useEffect(() => {
    const hooks = new DurabilityHooks();
    durabilityRef.current = hooks;

    const unsub = hooks.subscribe((event) => {
      if (event.type === 'visibilitychange' && !event.isHidden) {
        engineRef.current?.handleVisibilityChange(true, event.hiddenDurationMs).catch(() => {});
      } else if (event.type === 'pagehide') {
        engineRef.current?.flushOnPageHide().catch(() => {});
      }
    });

    return () => {
      unsub();
      hooks.destroy();
      durabilityRef.current = null;
    };
  }, []);

  const logEvent = async (kind: string, payload: Record<string, unknown>, createdAt?: string): Promise<number> => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    return engineRef.current.logEvent(kind, payload, createdAt);
  };

  const forceSyncNow = async (): Promise<void> => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    await engineRef.current.forceSyncNow();
  };

  const effectiveSyncState: SyncState = !isOnline
    ? { ...syncState, status: 'offline' }
    : syncState;

  const value: SyncContextValue = {
    syncState: effectiveSyncState,
    logEvent,
    forceSyncNow,
  };

  const engineIdentityChanged =
    lastUserIdRef.current !== userId || lastEventStoreRef.current !== eventStore;
  const shouldBlockOnInitialRestore =
    engineIdentityChanged || (effectiveSyncState.initialRestorePending && !initialRestoreTimedOut);

  return (
    <SyncContext.Provider value={value}>
      {shouldBlockOnInitialRestore ? <BootScreen longWait={showLongWaitCopy} /> : children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncContext must be used within SyncProvider');
  }
  return context;
}
