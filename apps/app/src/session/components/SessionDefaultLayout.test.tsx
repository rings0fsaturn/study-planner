import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionDefaultLayout, type SessionDefaultLayoutProps } from './SessionDefaultLayout';
import type { ActiveSessionRecord } from '../types';

vi.mock('../pomodoro', () => ({
  getPomodoroPhase: () => ({ phase: 'none', current: 0, total: 0, remainingMs: 0 }),
}));

function makeRecord(overrides?: Partial<ActiveSessionRecord>): ActiveSessionRecord {
  return {
    id: 1,
    sessionId: 'sess-1',
    materialId: 'mat-1',
    sessionTitle: 'Test material · session 1 of 3',
    slotDate: '2026-05-03',
    weekIndex: 0,
    plannedMinutes: 30,
    startedAt: new Date('2026-05-03T09:00:00Z').toISOString(),
    status: 'active',
    pauseIntervals: [],
    pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
    ...overrides,
  };
}

function makeProps(overrides?: Partial<SessionDefaultLayoutProps>): SessionDefaultLayoutProps {
  return {
    record: makeRecord(),
    sessionState: 'active',
    elapsedActiveMs: 5000,
    pomodoroPhase: { phase: 'none', current: 0, total: 0, remainingMs: 0 },
    isPaused: false,
    isOverrun: false,
    isBreak: false,
    overrunMinutes: 0,
    onPauseResume: vi.fn(),
    onEnd: vi.fn(),
    onComeBackLater: vi.fn(),
    ...overrides,
  };
}

describe('SessionDefaultLayout', () => {
  describe('article kind', () => {
    it('renders article banner when articleAutoOpened is true', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'article', materialUrl: 'https://example.com/article' }),
            articleAutoOpened: true,
          })}
        />
      );
      expect(screen.getByText('Article opened in a new tab')).toBeInTheDocument();
      expect(screen.getAllByText('Reopen article').length).toBeGreaterThanOrEqual(1);
    });

    it('does not render article banner when articleAutoOpened is false', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'article', materialUrl: 'https://example.com/article' }),
            articleAutoOpened: false,
          })}
        />
      );
      expect(screen.queryByText('Article opened in a new tab')).not.toBeInTheDocument();
    });

    it('shows "Reopen article" instead of "Open material" for articles', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'article', materialUrl: 'https://example.com/article' }),
            articleAutoOpened: true,
          })}
        />
      );
      expect(screen.getAllByText('Reopen article').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Open material')).not.toBeInTheDocument();
    });

    it('renders AR icon label for article kind', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'article', materialUrl: 'https://example.com/article' }),
          })}
        />
      );
      expect(screen.getByText('AR')).toBeInTheDocument();
    });
  });

  describe('manual kind with URL', () => {
    it('renders "Open material" button', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'manual', materialUrl: 'https://drive.google.com/some-pdf' }),
          })}
        />
      );
      expect(screen.getByText('Open material')).toBeInTheDocument();
    });

    it('does not render article banner', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'manual', materialUrl: 'https://drive.google.com/some-pdf' }),
          })}
        />
      );
      expect(screen.queryByText('Article opened in a new tab')).not.toBeInTheDocument();
    });

    it('renders NB icon label for manual kind', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'manual', materialUrl: 'https://drive.google.com/some-pdf' }),
          })}
        />
      );
      expect(screen.getByText('NB')).toBeInTheDocument();
    });
  });

  describe('manual kind without URL', () => {
    it('does not render "Open material" button', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'manual' }),
          })}
        />
      );
      expect(screen.queryByText('Open material')).not.toBeInTheDocument();
    });

    it('shows MANUAL · NO EMBED in material strip', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ kind: 'manual' }),
          })}
        />
      );
      expect(screen.getByText('MANUAL · NO EMBED')).toBeInTheDocument();
    });
  });

  describe('backward compatibility', () => {
    it('renders correctly when kind is undefined (pre-existing sessions)', () => {
      render(
        <SessionDefaultLayout
          {...makeProps({
            record: makeRecord({ materialUrl: 'https://example.com' }),
          })}
        />
      );
      expect(screen.getByText('Open material')).toBeInTheDocument();
      expect(screen.getByText('MANUAL · LINKED')).toBeInTheDocument();
      expect(screen.getByText('NB')).toBeInTheDocument();
    });
  });
});
