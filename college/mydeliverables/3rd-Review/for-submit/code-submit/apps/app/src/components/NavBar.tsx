import { Link, useLocation } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';

function HomeIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M3 12L12 4l9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function WeekIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function RoadmapIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: HomeIcon, prefix: '/home' },
  { to: '/session', label: 'Session', icon: SessionIcon, prefix: '/session' },
  { to: '/week', label: 'Week', icon: WeekIcon, prefix: '/week' },
  { to: '/roadmaps', label: 'Roadmaps', icon: RoadmapIcon, prefix: '/roadmap' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, prefix: '/settings' },
] as const;

export function NavBar() {
  const { pathname } = useLocation();

  const isActive = (prefix: string) => pathname.startsWith(prefix);

  return (
    <>
      {/* Mobile bottom tab bar */}
      <nav className="navbar-mobile mobile-only" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, prefix }) => (
          <Link
            key={to}
            to={to}
            className={`navbar-item${isActive(prefix) ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Desktop top nav bar */}
      <nav className="navbar-desktop desktop-only" aria-label="Main navigation">
        <div className="navbar-desktop-brand">Study Tracker</div>
        {NAV_ITEMS.map(({ to, label, prefix }) => (
          <Link
            key={to}
            to={to}
            className={`navbar-desktop-item${isActive(prefix) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <div className="navbar-desktop-spacer" />
        <SyncIndicator />
      </nav>
    </>
  );
}
