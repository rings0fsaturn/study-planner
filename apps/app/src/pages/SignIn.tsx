import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';
import { FieldGroup, FieldLabel, FieldInput, FieldHelper } from '../components/Field';

export function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    navigate('/home');
  };

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
        <Card variant="elevated" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
          <h1 className="t-display-3" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Sign in
          </h1>

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FieldInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </FieldGroup>

            {error && (
              <FieldHelper error>{error}</FieldHelper>
            )}

            <Button type="submit" variant="accent" block disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p className="t-body" style={{ marginBottom: '0.5rem' }}>
              Don't have an account?{' '}
              <Link to="/sign-up">Sign up</Link>
            </p>
            <p className="t-body">
              <Link to="/reset-password">Forgot password?</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}