import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { SyncIndicator } from './SyncIndicator';

export function AppShell() {
  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Mobile: slim top strip with sync indicator */}
      <div className="mobile-top-bar mobile-only">
        <SyncIndicator />
      </div>

      {/* Desktop: top nav bar (includes sync indicator) */}
      <NavBar />

      <main className="app-shell-content" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
