import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';
import GoogleIcon from '../components/GoogleIcon';
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
          <div className="auth-mark">
            <div className="auth-mark-name">Study Tracker</div>
            <div className="auth-mark-tag">A quiet companion</div>
          </div>

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
                placeholder="you@example.com"
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
                placeholder="At least 8 characters"
                error={!!error}
              />
            </FieldGroup>

            {error && (
              <FieldHelper error>
                <svg className="icon icon-sm" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: '-3px', marginRight: '4px' }}>
                  <circle cx="12" cy="12" r="9" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </FieldHelper>
            )}

            <Button type="submit" variant="primary" block disabled={loading}>
              {loading ? 'Signing in...' : 'Continue'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              block
              size="sm"
              onClick={() => navigate('/reset-password')}
              style={{ marginTop: '6px' }}
            >
              Forgot password?
            </Button>
          </form>

          <div className="divider-with-label">or</div>

          <button className="auth-social" disabled title="Coming soon">
            <GoogleIcon className="auth-social-glyph" />
            Continue with Google
          </button>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p className="t-body" style={{ marginBottom: '0.5rem' }}>
              Don't have an account?{' '}
              <Link to="/sign-up">Sign up</Link>
            </p>
          </div>

          <p style={{ marginTop: '2rem', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
            By continuing you agree to our{' '}
            <Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}