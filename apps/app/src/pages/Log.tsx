import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEventStore } from '../events/useEventStore';
import Card from '../components/Card';
import Button from '../components/Button';
import { FieldGroup, FieldLabel, FieldInput, FieldTextarea, FieldHelper } from '../components/Field';

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function Log() {
  const navigate = useNavigate();
  const eventStore = useEventStore();
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      setError('Please enter a valid duration in minutes');
      return;
    }

    setLoading(true);

    try {
      await eventStore.append('SessionLogged', {
        duration: durationNum,
        date,
        description: description.trim() || null
      });
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log session');
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
        <Card variant="elevated" style={{ maxWidth: '420px', width: '100%', padding: '2rem' }}>
          <h1 className="t-display-3" style={{ marginBottom: '0.5rem' }}>
            Log a past session
          </h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Record what you studied earlier
          </p>

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <FieldLabel htmlFor="duration">Duration (minutes)</FieldLabel>
              <FieldInput
                id="duration"
                type="number"
                min="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 45"
                required
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <FieldInput
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="description">What did you study?</FieldLabel>
              <FieldTextarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Chapter 3: Integration techniques"
                rows={3}
              />
            </FieldGroup>

            {error && (
              <FieldHelper error>{error}</FieldHelper>
            )}

            <Button type="submit" variant="accent" block disabled={loading}>
              {loading ? 'Logging...' : 'Log session'}
            </Button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/home" className="t-body">
              ← Back to Home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}