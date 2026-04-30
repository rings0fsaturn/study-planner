import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlaylistPickerPopup } from './PlaylistPickerPopup'
import type { PlaylistVideo } from '../OnboardingProvider'

function makeVideos(count: number): PlaylistVideo[] {
  return Array.from({ length: count }, (_, i) => ({
    youtubeVideoId: `v${i + 1}`,
    title: `Video ${i + 1}`,
    author: `Author ${i + 1}`,
    durationMinutes: 10 + i,
    selected: true,
  }))
}

describe('PlaylistPickerPopup', () => {
  it('renders all videos with correct data', () => {
    const videos = makeVideos(3)
    render(
      <PlaylistPickerPopup
        playlistTitle="Test Playlist"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Test Playlist')).toBeInTheDocument()
    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
    expect(screen.getByText('Video 3')).toBeInTheDocument()
  })

  it('paginates at 10 per page', () => {
    const videos = makeVideos(15)
    render(
      <PlaylistPickerPopup
        playlistTitle="Big Playlist"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 10')).toBeInTheDocument()
    expect(screen.queryByText('Video 11')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Video 11')).toBeInTheDocument()
    expect(screen.getByText('Video 15')).toBeInTheDocument()
    expect(screen.queryByText('Video 1')).not.toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Video 1')).toBeInTheDocument()
  })

  it('toggling a video applies strikethrough class', () => {
    const videos = makeVideos(3)
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    const row1 = screen.getByText('Video 1').closest('.playlist-picker-row')!
    expect(row1).not.toHaveClass('deselected')

    fireEvent.click(row1)
    expect(row1).toHaveClass('deselected')

    fireEvent.click(row1)
    expect(row1).not.toHaveClass('deselected')
  })

  it('select all / deselect all toggles', () => {
    const videos = makeVideos(3)
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Deselect all'))
    expect(screen.getByText(/0 selected/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Select all'))
    expect(screen.getByText(/3 selected/)).toBeInTheDocument()
  })

  it('confirm sends selected video IDs', () => {
    const videos = makeVideos(3)
    const onConfirm = vi.fn()
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={videos}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )

    // Deselect video 2
    const row2 = screen.getByText('Video 2').closest('.playlist-picker-row')!
    fireEvent.click(row2)

    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledWith(['v1', 'v3'])
  })

  it('cancel calls onCancel without confirming', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={makeVideos(3)}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirm is disabled when no videos selected', () => {
    const videos = makeVideos(1)
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    // Deselect the only video
    const row = screen.getByText('Video 1').closest('.playlist-picker-row')!
    fireEvent.click(row)

    expect(screen.getByText('Confirm')).toBeDisabled()
  })

  it('updates summary when toggling selections', () => {
    const videos = makeVideos(3) // 10 + 11 + 12 = 33 min total
    render(
      <PlaylistPickerPopup
        playlistTitle="Test"
        videos={videos}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText(/3 selected/)).toBeInTheDocument()

    const row1 = screen.getByText('Video 1').closest('.playlist-picker-row')!
    fireEvent.click(row1)

    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
  })
})
