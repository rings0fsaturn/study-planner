import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createContext, useContext, type ReactNode } from 'react';
import { SyncIndicator, formatTimeAgo } from './SyncIndicator';
import type { SyncState } from '../sync/types';

interface SyncContextValue {
  syncState: SyncState;
  forceSyncNow: () => Promise<void>;
}

const TestSyncContext = createContext<SyncContextValue | null>(null);

function FakeSyncProvider({ 
  children, 
  syncState,
  forceSyncNow = vi.fn().mockResolvedValue(undefined)
}: { 
  children: ReactNode;
  syncState: SyncState;
  forceSyncNow?: () => Promise<void>;
}) {
  return (
    <TestSyncContext.Provider value={{ syncState, forceSyncNow }}>
      {children}
    </TestSyncContext.Provider>
  );
}

vi.mock('../sync/useSync', () => ({
  useSync: () => {
    const context = useContext(TestSyncContext);
    if (!context) {
      throw new Error('useSync must be used within provider');
    }
    return context;
  }
}));

describe('SyncIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders idle state', () => {
    it('shows "Synced X ago" with moss dot when status is idle and lastSyncedAt is recent', async () => {
      const recentDate = new Date(Date.now() - 60 * 1000);
      
      render(
        <FakeSyncProvider syncState={{
          status: 'idle',
          lastSyncedAt: recentDate,
          lastError: null,
          pendingCount: 0,
        }}>
          <SyncIndicator />
        </FakeSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Synced/)).toBeInTheDocument();
      });
      const dot = document.querySelector('.sync-indicator-dot');
      expect(dot).toBeInTheDocument();
    });

    it('shows "Not yet synced" when lastSyncedAt is null', async () => {
      render(
        <FakeSyncProvider syncState={{
          status: 'idle',
          lastSyncedAt: null,
          lastError: null,
          pendingCount: 0,
        }}>
          <SyncIndicator />
        </FakeSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Not yet synced/)).toBeInTheDocument();
      });
    });
  });

  describe('renders syncing state', () => {
    it('shows "Syncing..." with terracotta dot when status is syncing', async () => {
      render(
        <FakeSyncProvider syncState={{
          status: 'syncing',
          lastSyncedAt: new Date(),
          lastError: null,
          pendingCount: 0,
        }}>
          <SyncIndicator />
        </FakeSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Syncing/)).toBeInTheDocument();
      });
      const container = document.querySelector('.sync-indicator');
      expect(container?.classList.contains('syncing')).toBe(true);
    });
  });

  describe('renders error state', () => {
    it('shows "Sync failed" with rust dot when status is error', async () => {
      render(
        <FakeSyncProvider syncState={{
          status: 'error',
          lastSyncedAt: new Date(),
          lastError: 'Network error',
          pendingCount: 3,
        }}>
          <SyncIndicator />
        </FakeSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Sync failed/)).toBeInTheDocument();
      });
      const container = document.querySelector('.sync-indicator');
      expect(container?.classList.contains('failed')).toBe(true);
    });
  });

  describe('renders offline state', () => {
    it('shows "Offline" with ink-faint dot when status is offline', async () => {
      render(
        <FakeSyncProvider syncState={{
          status: 'offline',
          lastSyncedAt: new Date(),
          lastError: null,
          pendingCount: 0,
        }}>
          <SyncIndicator />
        </FakeSyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Offline/)).toBeInTheDocument();
      });
      const container = document.querySelector('.sync-indicator');
      expect(container?.classList.contains('offline')).toBe(true);
    });
  });

  describe('click triggers forceSyncNow', () => {
    it('calls forceSyncNow when clicked in idle state', async () => {
      const forceSyncNow = vi.fn().mockResolvedValue(undefined);
      
      render(
        <FakeSyncProvider 
          syncState={{
            status: 'idle',
            lastSyncedAt: new Date(),
            lastError: null,
            pendingCount: 0,
          }}
          forceSyncNow={forceSyncNow}
        >
          <SyncIndicator />
        </FakeSyncProvider>
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(forceSyncNow).toHaveBeenCalled();
      });
    });
  });
});

describe('formatTimeAgo', () => {
  it('returns "Not yet synced" when date is null', () => {
    expect(formatTimeAgo(null)).toBe('Not yet synced');
  });

  it('returns "Just now" when less than 10 seconds ago', () => {
    const recent = new Date(Date.now() - 5 * 1000);
    expect(formatTimeAgo(recent)).toBe('Just now');
  });

  it('returns "X s ago" when less than 60 seconds ago', () => {
    const secondsAgo = new Date(Date.now() - 30 * 1000);
    expect(formatTimeAgo(secondsAgo)).toBe('30 s ago');
  });

  it('returns "X m ago" when less than 60 minutes ago', () => {
    const minutesAgo = new Date(Date.now() - 45 * 60 * 1000);
    expect(formatTimeAgo(minutesAgo)).toBe('45 m ago');
  });

  it('returns "X h ago" when less than 24 hours ago', () => {
    const hoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    expect(formatTimeAgo(hoursAgo)).toBe('5 h ago');
  });

  it('returns "X d ago" when more than 24 hours ago', () => {
    const daysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(daysAgo)).toBe('2 d ago');
  });
});