import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SyncEngine } from './SyncEngine';
import type { SupabaseClientLike, SyncState } from './types';
import type { EventStore } from '../events/EventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';

const DEFAULT_OPTIONS = {
  visibilityIdleThresholdMs: 5 * 60 * 1000,
};

interface SyncContextValue {
  syncState: SyncState;
  logEvent: (kind: string, payload: Record<string, unknown>) => Promise<number>;
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
}

export function SyncProvider({ children, supabase, supabaseUrl, userId, eventStore }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncedAt: null,
    lastError: null,
    pendingCount: 0,
  });
  const [isOnline, setIsOnline] = useState(true);

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

    const sendBeaconUrl = supabaseUrl ? `${supabaseUrl}/rest/v1/events` : '';

    const engine = new SyncEngine(
      supabase,
      eventStore,
      userId,
      clientIdRef.current,
      (newState) => setSyncState(newState),
      sendBeaconUrl,
      DEFAULT_OPTIONS
    );

    engineRef.current = engine;
    lastUserIdRef.current = userId;
    lastEventStoreRef.current = eventStore;

    engine.restoreFromCloud().catch(() => {});

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [supabase, userId, eventStore]);

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

  const logEvent = async (kind: string, payload: Record<string, unknown>): Promise<number> => {
    if (!engineRef.current) {
      throw new Error('SyncEngine not initialized');
    }
    return engineRef.current.logEvent(kind, payload);
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

  return (
    <SyncContext.Provider value={value}>
      {children}
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