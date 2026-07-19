import { Link } from 'react-router-dom';
import Card from '../components/Card';

export function AuthConfirmed() {
  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
        <Card variant="elevated" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
          <h1 className="t-display-3" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Email confirmed
          </h1>
          <p className="t-body" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            Your email has been verified. You can now sign in to your account.
          </p>
          <div style={{ textAlign: 'center' }}>
            <Link to="/sign-in">Sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}