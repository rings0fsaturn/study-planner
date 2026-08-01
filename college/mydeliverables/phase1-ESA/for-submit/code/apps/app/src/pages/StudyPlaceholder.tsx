import Button from '../components/Button';
import Card from '../components/Card';
import Tag from '../components/Tag';

export default function StudyPlaceholder() {
  return (
    <div className="study-placeholder">
      <div className="container">
        <div className="placeholder-header">
          <span className="t-mono">STUDY TRACKER // TRACER</span>
          <h1 className="t-display-3">Welcome to Study Tracker</h1>
          <p className="t-body placeholder-desc">
            This is the placeholder page for the app at <code>/study/</code>.
            Auth, onboarding, and business logic are not yet implemented.
          </p>
        </div>

        <div className="components-demo">
          <h2 className="t-mono">Design System Primitives</h2>
          <div className="demo-grid">
            <Card>
              <div className="card-content">
                <span className="card-eyebrow">Card</span>
                <h3 className="card-title">This is a card</h3>
                <p className="card-meta">Demonstrating the card component with title and meta.</p>
              </div>
            </Card>

            <Card variant="elevated">
              <div className="card-content">
                <span className="card-eyebrow">Elevated Card</span>
                <h3 className="card-title">Elevated variant</h3>
                <p className="card-meta">Cards can be elevated with shadow.</p>
              </div>
            </Card>

            <Card variant="inverted">
              <div className="card-content">
                <span className="card-eyebrow">Inverted</span>
                <h3 className="card-title">Inverted card</h3>
                <p className="card-meta">For use on dark backgrounds.</p>
              </div>
            </Card>
          </div>

          <div className="demo-section">
            <h3 className="t-mono">Buttons</h3>
            <div className="button-row">
              <Button variant="accent">Get started</Button>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </div>

          <div className="demo-section">
            <h3 className="t-mono">Tags</h3>
            <div className="tag-row">
              <Tag>Default</Tag>
              <Tag variant="moss">On track</Tag>
              <Tag variant="rust">Behind</Tag>
              <Tag variant="terracotta">Attention</Tag>
            </div>
          </div>
        </div>

        <div className="placeholder-status">
          <Tag>Status: Placeholder</Tag>
        </div>
      </div>

      <style>{`
        .study-placeholder {
          min-height: 100vh;
          padding: var(--space-6) 0;
          background: var(--surface-page);
        }

        .container {
          max-width: var(--container-default);
          margin: 0 auto;
          padding: 0 var(--space-5);
        }

        .placeholder-header {
          margin-bottom: var(--space-7);
          padding: var(--space-6);
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .placeholder-header .t-mono {
          display: block;
          color: var(--terracotta);
          margin-bottom: var(--space-3);
        }

        .placeholder-header h1 {
          margin-bottom: var(--space-3);
        }

        .placeholder-desc {
          color: var(--text-secondary);
          max-width: 480px;
        }

        .placeholder-desc code {
          font-family: var(--font-mono);
          background: var(--paper-deep);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
        }

        .components-demo {
          margin-bottom: var(--space-6);
        }

        .components-demo h2 {
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--border-subtle);
        }

        .demo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }

        .card-content {
          min-height: 100px;
        }

        .card-content .card-meta {
          margin-bottom: 0;
        }

        .demo-section {
          margin-bottom: var(--space-5);
        }

        .demo-section h3 {
          margin-bottom: var(--space-3);
          color: var(--text-secondary);
        }

        .button-row {
          display: flex;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        .tag-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .placeholder-status {
          text-align: center;
        }
      `}</style>
    </div>
  );
}