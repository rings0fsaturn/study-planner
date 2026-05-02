import { describe, it, expect } from 'vitest';
import { resolveSessionLayout } from './resolveSessionLayout';
import type { ActiveSessionRecord } from './types';

function makeRecord(overrides: Partial<ActiveSessionRecord> = {}): ActiveSessionRecord {
  return {
    id: 1,
    sessionId: 'test-session-id',
    materialId: 'mat-1',
    sessionTitle: 'Test Session',
    slotDate: '2026-05-01',
    weekIndex: 2,
    plannedMinutes: 60,
    startedAt: new Date().toISOString(),
    status: 'active',
    pauseIntervals: [],
    pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
    ...overrides,
  };
}

describe('resolveSessionLayout', () => {
  describe('YouTube sessions', () => {
    it('shows YouTube embed on mobile', () => {
      const record = makeRecord({ kind: 'youtube', youtubeVideoId: 'abc123' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.showYouTubeEmbed).toBe(true);
      expect(layout.showArticleBanner).toBe(false);
      expect(layout.showOpenMaterialButton).toBe(false);
      expect(layout.useDesktopTimerStrip).toBe(false);
      expect(layout.materialIcon).toBe('YT');
      expect(layout.materialMeta).toBe('YOUTUBE');
    });

    it('shows timer strip and embed on desktop', () => {
      const record = makeRecord({ kind: 'youtube', youtubeVideoId: 'abc123' });
      const layout = resolveSessionLayout(record, 'active', true, false, 0, false, false);
      expect(layout.showYouTubeEmbed).toBe(true);
      expect(layout.useDesktopTimerStrip).toBe(true);
      expect(layout.showFab).toBe(true);
      expect(layout.showInlineEnd).toBe(false);
      expect(layout.showEscHint).toBe(true);
    });

    it('shows resume hint on resume', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, true, 0, false, false);
      expect(layout.showResumeHint).toBe(true);
    });

    it('does not show resume hint for fresh start', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.showResumeHint).toBe(false);
    });

    it('does not show resume hint during walk_away', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'walk_away', false, true, 0, false, false);
      expect(layout.showResumeHint).toBe(false);
    });
  });

  describe('Article sessions', () => {
    it('shows article banner on mobile', () => {
      const record = makeRecord({ kind: 'article', materialUrl: 'https://example.com' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.showArticleBanner).toBe(true);
      expect(layout.showYouTubeEmbed).toBe(false);
      expect(layout.showReOpenButton).toBe(false);
      expect(layout.materialIcon).toBe('BK');
    });

    it('shows re-open button after article opened', () => {
      const record = makeRecord({ kind: 'article', materialUrl: 'https://example.com' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, true);
      expect(layout.showReOpenButton).toBe(true);
    });

    it('shows timer strip on desktop', () => {
      const record = makeRecord({ kind: 'article', materialUrl: 'https://example.com' });
      const layout = resolveSessionLayout(record, 'active', true, false, 0, false, false);
      expect(layout.useDesktopTimerStrip).toBe(true);
    });
  });

  describe('Manual sessions', () => {
    it('shows large timer on mobile without URL', () => {
      const record = makeRecord({ kind: 'manual' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.timerSizeClass).toBe('session-timer-large');
      expect(layout.showOpenMaterialButton).toBe(false);
      expect(layout.materialMeta).toBe('MANUAL · NO EMBED');
    });

    it('shows giant timer on desktop without URL', () => {
      const record = makeRecord({ kind: 'manual' });
      const layout = resolveSessionLayout(record, 'active', true, false, 0, false, false);
      expect(layout.timerSizeClass).toBe('session-timer-giant');
      expect(layout.useDesktopTimerStrip).toBe(false);
    });

    it('shows open material button with URL', () => {
      const record = makeRecord({ kind: 'manual', materialUrl: 'https://drive.google.com/doc' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.showOpenMaterialButton).toBe(true);
      expect(layout.materialMeta).toBe('MANUAL · LINKED');
    });

    it('defaults to manual when kind is undefined', () => {
      const record = makeRecord();
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.materialIcon).toBe('NB');
      expect(layout.showYouTubeEmbed).toBe(false);
      expect(layout.showArticleBanner).toBe(false);
    });
  });

  describe('Overrun state', () => {
    it('sets terracotta eyebrow on overrun', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, false, 18, false, false);
      expect(layout.frameOverrun).toBe(true);
      expect(layout.eyebrowColorClass).toBe('eyebrow-terracotta');
      expect(layout.eyebrowText).toContain('18 min over plan');
    });

    it('sets faint eyebrow when paused', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'paused', false, false, 0, false, false);
      expect(layout.eyebrowColorClass).toBe('eyebrow-faint');
      expect(layout.eyebrowText).toContain('Paused');
    });

    it('sets clay eyebrow during break', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, true, false);
      expect(layout.eyebrowColorClass).toBe('eyebrow-clay');
      expect(layout.eyebrowText).toContain('On break');
    });
  });

  describe('Resume hint for non-YouTube', () => {
    it('does not show for article resume', () => {
      const record = makeRecord({ kind: 'article' });
      const layout = resolveSessionLayout(record, 'active', false, true, 0, false, false);
      expect(layout.showResumeHint).toBe(false);
    });

    it('does not show for manual resume', () => {
      const record = makeRecord({ kind: 'manual' });
      const layout = resolveSessionLayout(record, 'active', false, true, 0, false, false);
      expect(layout.showResumeHint).toBe(false);
    });
  });

  describe('Subtitle computation', () => {
    it('returns YouTube video for youtube kind', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.subtitle).toBe('YouTube video');
    });

    it('returns Article for article kind', () => {
      const record = makeRecord({ kind: 'article' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.subtitle).toBe('Article');
    });

    it('returns Linked material for manual with URL', () => {
      const record = makeRecord({ kind: 'manual', materialUrl: 'https://example.com' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.subtitle).toBe('Linked material');
    });

    it('returns Manual pen and paper for manual without URL', () => {
      const record = makeRecord({ kind: 'manual' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.subtitle).toBe('Manual · pen and paper');
    });
  });

  describe('Article eyebrow', () => {
    it('uses Reading verb for article kind', () => {
      const record = makeRecord({ kind: 'article' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.eyebrowText).toContain('Reading');
    });

    it('uses In session verb for youtube kind', () => {
      const record = makeRecord({ kind: 'youtube' });
      const layout = resolveSessionLayout(record, 'active', false, false, 0, false, false);
      expect(layout.eyebrowText).toContain('In session');
    });
  });
});
