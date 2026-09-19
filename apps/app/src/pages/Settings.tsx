import { useState } from 'react';
import { useAuth } from '../auth/useAuth';

export function Settings() {
  const { user, signOut } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1 className="t-display-2" style={{ marginBottom: '0.5rem' }}>
        Settings
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Preferences and account.
      </p>

      <div className="mono-caps" style={{ marginBottom: 8 }}>Account</div>
      <div className="settings-group" data-testid="settings-account-group">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-label">Signed in as</div>
            <div className="settings-row-sub">{user?.email ?? 'Not signed in'}</div>
          </div>
        </div>

        {confirmingSignOut ? (
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label destructive">Sign out?</div>
              <div className="settings-row-sub">
                Your sessions stay on this device and sync again when you sign back in.
              </div>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setConfirmingSignOut(false)}>
              Cancel
            </button>
            <button className="btn btn-destructive" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="settings-row"
            type="button"
            onClick={() => setConfirmingSignOut(true)}
          >
            <div className="settings-row-body">
              <div className="settings-row-label destructive">Sign out</div>
            </div>
            <span className="settings-row-chevron" aria-hidden="true">&rsaquo;</span>
          </button>
        )}
      </div>
    </div>
  );
}
