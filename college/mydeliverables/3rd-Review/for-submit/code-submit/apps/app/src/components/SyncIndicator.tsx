import { useSync } from '../sync/useSync';

export function formatTimeAgo(date: Date | null): string {
  if (!date) {
    return 'Not yet synced';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) {
    return 'Just now';
  }
  if (diffSec < 60) {
    return `${diffSec} s ago`;
  }
  if (diffMin < 60) {
    return `${diffMin} m ago`;
  }
  if (diffHr < 24) {
    return `${diffHr} h ago`;
  }
  return `${diffDay} d ago`;
}

function getStatusText(status: string, lastSyncedAt: Date | null): string {
  switch (status) {
    case 'syncing':
      return 'Syncing...';
    case 'error':
      return 'Sync failed';
    case 'offline':
      return 'Offline';
    case 'idle':
    default:
      return `Synced ${formatTimeAgo(lastSyncedAt)}`;
  }
}

export function SyncIndicator() {
  const { syncState, forceSyncNow } = useSync();
  const { status, lastSyncedAt } = syncState;

  const statusClass = status === 'error' ? 'failed' : status;

  const handleClick = () => {
    if (status !== 'syncing') {
      forceSyncNow();
    }
  };

  return (
    <button
      className={`sync-indicator ${statusClass}`}
      onClick={handleClick}
      aria-label={`Sync status: ${getStatusText(status, lastSyncedAt)}. Tap to sync now.`}
      type="button"
    >
      <span className="sync-indicator-dot" />
      <span className="sync-indicator-text">
        {getStatusText(status, lastSyncedAt)}
      </span>
    </button>
  );
}