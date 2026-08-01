import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';
import { FieldGroup, FieldLabel, FieldInput, FieldHelper } from '../components/Field';

export function SignUp() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signUp(email, password);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
          <Card variant="elevated" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
            <h1 className="t-display-3" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              Check your email
            </h1>
            <p className="t-body" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              We've sent a confirmation link to <strong>{email}</strong>.
            </p>
            <p className="t-body" style={{ textAlign: 'center' }}>
              Click the link to activate your account, then come back to sign in.
            </p>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <Link to="/sign-in">Already have an account? Sign in</Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
        <Card variant="elevated" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
          <h1 className="t-display-3" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            Create your account
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
                autoComplete="new-password"
                minLength={6}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <FieldInput
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </FieldGroup>

            {error && (
              <FieldHelper error>{error}</FieldHelper>
            )}

            <Button type="submit" variant="accent" block disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p className="t-body">
              Already have an account?{' '}
              <Link to="/sign-in">Sign in</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}