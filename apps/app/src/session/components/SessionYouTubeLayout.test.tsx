import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionYouTubeLayout, type SessionYouTubeLayoutProps } from './SessionYouTubeLayout';
import type { ActiveSessionRecord } from '../types';
import type { YouTubePlayerAdapter } from '../YouTubePlayerAdapter';
import React from 'react';

vi.mock('../pomodoro', () => ({
  getPomodoroPhase: () => ({ phase: 'none', current: 0, total: 0, remainingMs: 0 }),
}));

vi.mock('../loadYouTubeApi', () => ({
  loadYouTubeApi: () => Promise.resolve(),
}));

vi.mock('./YouTubeEmbed', () => ({
  YouTubeEmbed: ({ videoId }: { videoId: string }) => (
    <div data-testid="youtube-embed" data-video-id={videoId} className="session-yt-embed-container" />
  ),
}));

function makeRecord(overrides?: Partial<ActiveSessionRecord>): ActiveSessionRecord {
  return {
    id: 1,
    sessionId: 'sess-1',
    materialId: 'mat-1',
    sessionTitle: 'Calculus Lecture 5',
    slotDate: '2026-05-03',
    weekIndex: 0,
    plannedMinutes: 30,
    startedAt: new Date('2026-05-03T09:00:00Z').toISOString(),
    status: 'active',
    pauseIntervals: [],
    pomodoroConfig: { workMinutes: 50, breakMinutes: 10 },
    kind: 'youtube',
    youtubeVideoId: 'dQw4w9WgXcQ',
    ...overrides,
  };
}

function makeProps(overrides?: Partial<SessionYouTubeLayoutProps>): SessionYouTubeLayoutProps {
  return {
    record: makeRecord(),
    sessionState: 'active',
    elapsedActiveMs: 19000,
    pomodoroPhase: { phase: 'none', current: 0, total: 0, remainingMs: 0 },
    isPaused: false,
    isOverrun: false,
    isBreak: false,
    overrunMinutes: 0,
    isDesktop: true,
    onPauseResume: vi.fn(),
    onEnd: vi.fn(),
    onComeBackLater: vi.fn(),
    playerAdapterRef: { current: null } as React.MutableRefObject<YouTubePlayerAdapter | null>,
    playerState: 'playing',
    videoDurationFormatted: '4:12',
    resumeBannerVisible: false,
    onDismissResumeBanner: vi.fn(),
    videoEndedPromptVisible: false,
    onPlayerStateChange: vi.fn(),
    onPlayerReady: vi.fn(),
    ...overrides,
  };
}

describe('SessionYouTubeLayout', () => {
  it('renders YouTube embed container', () => {
    render(<SessionYouTubeLayout {...makeProps()} />);
    expect(screen.getByTestId('youtube-embed')).toBeInTheDocument();
  });

  it('renders session title in timer panel', () => {
    render(<SessionYouTubeLayout {...makeProps()} />);
    expect(screen.getByText('Calculus Lecture 5')).toBeInTheDocument();
  });

  it('renders video status strip with PLAYING state', () => {
    render(<SessionYouTubeLayout {...makeProps({ playerState: 'playing' })} />);
    expect(screen.getByText('YOUTUBE · 4:12 · PLAYING')).toBeInTheDocument();
  });

  it('renders video status strip with PAUSED state', () => {
    render(<SessionYouTubeLayout {...makeProps({ playerState: 'paused' })} />);
    expect(screen.getByText('YOUTUBE · 4:12 · PAUSED')).toBeInTheDocument();
  });

  it('renders video status strip with ENDED state', () => {
    render(<SessionYouTubeLayout {...makeProps({ playerState: 'ended' })} />);
    expect(screen.getByText('YOUTUBE · 4:12 · ENDED')).toBeInTheDocument();
  });

  it('shows PRESS ESC TO END on desktop', () => {
    render(<SessionYouTubeLayout {...makeProps({ isDesktop: true })} />);
    expect(screen.getByText('PRESS ESC TO END')).toBeInTheDocument();
  });

  it('hides PRESS ESC TO END on mobile', () => {
    render(<SessionYouTubeLayout {...makeProps({ isDesktop: false })} />);
    expect(screen.queryByText('PRESS ESC TO END')).not.toBeInTheDocument();
  });

  it('shows inline End button on mobile', () => {
    render(<SessionYouTubeLayout {...makeProps({ isDesktop: false })} />);
    expect(screen.getByText('End session')).toBeInTheDocument();
  });

  it('shows fixed FAB End button on desktop', () => {
    render(<SessionYouTubeLayout {...makeProps({ isDesktop: true })} />);
    expect(screen.getByText('End session')).toBeInTheDocument();
  });

  it('renders resume banner when resumeBannerVisible is true', () => {
    render(<SessionYouTubeLayout {...makeProps({ resumeBannerVisible: true })} />);
    expect(screen.getByText('Resumed from where you left off')).toBeInTheDocument();
  });

  it('does not render resume banner when resumeBannerVisible is false', () => {
    render(<SessionYouTubeLayout {...makeProps({ resumeBannerVisible: false })} />);
    expect(screen.queryByText('Resumed from where you left off')).not.toBeInTheDocument();
  });

  it('renders video ended prompt when videoEndedPromptVisible is true', () => {
    render(<SessionYouTubeLayout {...makeProps({ videoEndedPromptVisible: true })} />);
    expect(screen.getByText('Video finished')).toBeInTheDocument();
  });

  it('applies is-paused class when paused', () => {
    const { container } = render(<SessionYouTubeLayout {...makeProps({ isPaused: true })} />);
    expect(container.querySelector('.session-layout-youtube.is-paused')).toBeInTheDocument();
  });

  it('does not apply is-paused class when active', () => {
    const { container } = render(<SessionYouTubeLayout {...makeProps({ isPaused: false })} />);
    expect(container.querySelector('.session-layout-youtube.is-paused')).not.toBeInTheDocument();
  });
});
