import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { SyncIndicator } from './SyncIndicator';

export function AppShell() {
  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Mobile: slim top strip with sync indicator */}
      <div className="mobile-top-bar mobile-only">
        <SyncIndicator />
      </div>

      {/* Desktop: top nav bar (includes sync indicator) */}
      <NavBar />

      <main className="app-shell-content">
        <Outlet />
      </main>
    </div>
  );
}
