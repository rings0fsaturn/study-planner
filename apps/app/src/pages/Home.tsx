import { useAuth } from '../auth/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';

export function Home() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="app">
      <div style={{ padding: '2rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
        <h1 className="t-display-2" style={{ marginBottom: '2rem' }}>
          Hello, {user?.email}
        </h1>

        <Card variant="elevated" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 className="card-title">You're signed in</h2>
          <p className="card-meta">Home page content arrives in later slices.</p>
        </Card>

        <Button variant="ghost" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}