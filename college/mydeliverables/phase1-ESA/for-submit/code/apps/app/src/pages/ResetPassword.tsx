import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import Card from '../components/Card';
import Button from '../components/Button';
import { FieldGroup, FieldLabel, FieldInput, FieldHelper } from '../components/Field';

export function ResetPassword() {
  const { resetPassword, updatePassword, recoveryMode } = useAuth();
  const isRecoveryMode = recoveryMode;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const errorDescription = params.get('error_description');
    if (errorDescription) {
      setError(errorDescription.replace(/\+/g, ' '));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await resetPassword(email);

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
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

    const result = await updatePassword(password);

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
              {isRecoveryMode ? 'Password updated' : 'Check your email'}
            </h1>
            <p className="t-body" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              {isRecoveryMode
                ? 'Your password has been updated. You can now sign in.'
                : "We've sent a password reset link to your email."}
            </p>
            <div style={{ textAlign: 'center' }}>
              <Link to="/sign-in">
                {isRecoveryMode ? 'Sign in' : 'Back to sign in'}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isRecoveryMode) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
          <Card variant="elevated" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
            <h1 className="t-display-3" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              Set new password
            </h1>

            <form onSubmit={handleSetNewPassword}>
              <FieldGroup>
                <FieldLabel htmlFor="password">New password</FieldLabel>
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

              {error && <FieldHelper error>{error}</FieldHelper>}

              <Button type="submit" variant="accent" block disabled={loading}>
                {loading ? 'Updating password...' : 'Update password'}
              </Button>
            </form>
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
            Reset password
          </h1>

          <form onSubmit={handleRequestReset}>
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

            {error && <FieldHelper error>{error}</FieldHelper>}

            <Button type="submit" variant="accent" block disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p className="t-body">
              <Link to="/sign-in">Back to sign in</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}