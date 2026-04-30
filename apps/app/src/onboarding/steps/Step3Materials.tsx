import { useRef, useState, useCallback } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useOnboarding, type OnboardingMaterial } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import { MaterialRow } from '../components/MaterialRow'
import { Step3Preview } from './Step3Preview'
import { useMatchMedia } from '../../lib/useMatchMedia'
import { useMetadataFetcher } from '../MetadataFetcherContext'
import { classifyUrl, extractYouTubeVideoId, extractYouTubePlaylistId } from '../url-classifier'
import { PlaylistCard } from '../components/PlaylistCard'
import { YouTubePopup } from '../components/YouTubePopup'
import { PasteAnimation } from '../components/PasteAnimation'

export function Step3Materials() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useMatchMedia('(min-width: 1024px)')
  const isPreviewRoute = location.pathname.includes('/preview')
  const metadataFetcher = useMetadataFetcher()
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [youtubePopupMaterialId, setYoutubePopupMaterialId] = useState<string | null>(null)
  const [pasteAnimKey, setPasteAnimKey] = useState(0)
  const [lastPastedUrl, setLastPastedUrl] = useState('')
  const youtubePopupMaterial = youtubePopupMaterialId ? state.materials.find(m => m.id === youtubePopupMaterialId) : null

  const handleAdd = () => {
    dispatch({
      type: 'ADD_MATERIAL',
      material: {
        id: crypto.randomUUID(),
        title: '',
        estimatedDuration: 0,
        role: 'foundation',
        url: undefined,
        additionOrder: state.materials.length,
        userOverrodeType: false,
        kind: 'manual',
        fetchStatus: 'idle',
      },
    })
  }

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').trim()
    if (!text) return

    event.preventDefault()
    setUrlError(null)

    const kind = classifyUrl(text)
    if (kind === 'unknown') {
      setUrlError('This doesn\'t look like a valid URL. Try pasting a YouTube or article link.')
      return
    }

    if (kind === 'youtube-video') {
      const videoId = extractYouTubeVideoId(text)
      if (videoId && state.materials.some(m => m.youtubeVideoId === videoId)) {
        setUrlError('This material has already been added.')
        return
      }
    } else if (kind === 'youtube-playlist') {
      const playlistId = extractYouTubePlaylistId(text)
      if (playlistId && state.playlists.some(p => p.youtubePlaylistId === playlistId)) {
        setUrlError('This material has already been added.')
        return
      }
    } else if (kind === 'article') {
      if (state.materials.some(m => m.url === text)) {
        setUrlError('This material has already been added.')
        return
      }
    }

    setLastPastedUrl(text)
    setPasteAnimKey(k => k + 1)

    if (kind === 'youtube-playlist') {
      const playlistId = extractYouTubePlaylistId(text)
      if (!playlistId) {
        setUrlError('Could not read the playlist ID from this URL.')
        return
      }
      const entryId = crypto.randomUUID()
      dispatch({
        type: 'ADD_PLAYLIST',
        playlist: { id: entryId, title: '', fetchStatus: 'loading', youtubePlaylistId: playlistId, videos: [] },
      })

      const result = await metadataFetcher.fetchMetadata(text)
      if (result.type === 'youtube-playlist') {
        dispatch({
          type: 'PLAYLIST_FETCH_SUCCEEDED',
          playlistId: entryId,
          title: result.playlistTitle,
          videos: result.videos.map(v => ({ ...v, selected: true })),
        })
      } else {
        dispatch({ type: 'PLAYLIST_FETCH_FAILED', playlistId: entryId })
      }
      return
    }

    const materialId = crypto.randomUUID()
    const materialKind = kind === 'youtube-video' ? 'youtube' as const : 'article' as const
    const youtubeVideoId = kind === 'youtube-video' ? extractYouTubeVideoId(text) ?? undefined : undefined

    dispatch({
      type: 'ADD_MATERIAL',
      material: {
        id: materialId,
        title: '',
        estimatedDuration: 0,
        role: 'foundation',
        url: text,
        additionOrder: state.materials.length,
        userOverrodeType: false,
        kind: materialKind,
        fetchStatus: 'loading',
        youtubeVideoId,
      },
    })

    const result = await metadataFetcher.fetchMetadata(text)
    if (result.type === 'error') {
      dispatch({ type: 'FETCH_FAILED', id: materialId })
    } else if (result.type === 'youtube-video') {
      dispatch({
        type: 'FETCH_SUCCEEDED',
        id: materialId,
        updates: {
          title: result.title,
          estimatedDuration: result.durationMinutes,
          youtubeVideoId: result.youtubeVideoId,
        },
      })
    } else if (result.type === 'article') {
      dispatch({
        type: 'FETCH_SUCCEEDED',
        id: materialId,
        updates: {
          title: result.title,
          estimatedDuration: result.durationMinutes ?? 0,
        },
      })
    }
  }, [dispatch, metadataFetcher, state.materials, state.playlists])

  const handleUpdate = (id: string, updates: Partial<OnboardingMaterial>) =>
    dispatch({ type: 'UPDATE_MATERIAL', id, updates })
  const handleRemove = (id: string) => dispatch({ type: 'REMOVE_MATERIAL', id })
  const handlePlaylistConfirm = (playlistId: string, selectedVideoIds: string[]) =>
    dispatch({ type: 'PLAYLIST_CONFIRM', playlistId, selectedVideoIds })
  const handlePlaylistRemove = (playlistId: string) =>
    dispatch({ type: 'REMOVE_PLAYLIST', playlistId })
  const handleBack = () => navigate('/onboarding/2')
  const handleBuildPlan = () => {
    dispatch({ type: 'SET_STEP_REACHED', step: 3 })
    navigate('/onboarding/3/preview')
  }

  const materialsWithTitle = state.materials.filter(m => m.title && m.estimatedDuration > 0)
  const totalMinutes = materialsWithTitle.reduce((s, m) => s + m.estimatedDuration, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMinsRemainder = totalMinutes % 60

  const formMarkup = (
    <>
      <h1 className="onboarding-h1">
        What are you <em>studying</em>?
      </h1>
      <p className="onboarding-lead">Paste links, or add things by hand.</p>

      <div className="field-group">
        <label className="field-label">Paste a URL</label>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            ref={urlInputRef}
            className={`field${urlError ? ' has-error' : ''}`}
            type="url"
            placeholder="youtube.com/… or any article link"
            onPaste={handlePaste}
          />
          <PasteAnimation triggerKey={pasteAnimKey} pastedUrl={lastPastedUrl} />
        </div>
        {urlError ? (
          <div className="field-helper error">{urlError}</div>
        ) : (
          <div className="field-helper">We'll fetch the title and length for you.</div>
        )}
      </div>

      <button className="btn btn-secondary btn-sm onboarding-add-manually-btn" onClick={handleAdd}>
        <svg className="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add manually
      </button>

      {(state.materials.length > 0 || state.playlists.length > 0) && (
        <>
          <div className="mono-caps onboarding-materials-count">
            {materialsWithTitle.length} added · ~{totalHours}h {totalMinsRemainder}m
          </div>
          <div className="material-list">
            {state.playlists.map(pl => (
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                onConfirm={handlePlaylistConfirm}
                onRemove={handlePlaylistRemove}
              />
            ))}
            {state.materials.map(mat => (
              <MaterialRow
                key={mat.id}
                material={mat}
                existingMaterials={state.materials}
                onUpdate={updates => handleUpdate(mat.id, updates)}
                onRemove={() => handleRemove(mat.id)}
                onClickCard={mat.kind === 'youtube' && mat.youtubeVideoId && mat.fetchStatus === 'success'
                  ? () => setYoutubePopupMaterialId(mat.id)
                  : undefined}
              />
            ))}
          </div>
        </>
      )}

      <div className="onboarding-spacer" />

      <div className="onboarding-actions">
        <button className="btn btn-secondary onboarding-back-btn" onClick={handleBack} aria-label="Back">
          <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        {/* Mobile only: navigates to the preview sub-route. CSS hides on desktop. */}
        <button
          className="btn btn-primary btn-lg onboarding-continue-btn onboarding-form-build-btn"
          onClick={handleBuildPlan}
          disabled={materialsWithTitle.length === 0}
        >
          Build my plan
          <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </>
  )

  const youtubePopupEl = youtubePopupMaterial ? (
    <YouTubePopup
      material={youtubePopupMaterial}
      onUpdate={updates => handleUpdate(youtubePopupMaterial.id, updates)}
      onClose={() => setYoutubePopupMaterialId(null)}
    />
  ) : null

  if (isDesktop) {
    return (
      <CheckpointGate step={3}>
        <div className="onboarding-step onboarding-materials-grid">
          <div className="onboarding-materials-form">{formMarkup}</div>
          <div className="onboarding-materials-preview-slot">
            <div className="mono-caps onboarding-materials-preview-label">Live preview · updates as you add</div>
            <Step3Preview />
          </div>
        </div>
        {youtubePopupEl}
      </CheckpointGate>
    )
  }

  return (
    <CheckpointGate step={3}>
      {isPreviewRoute ? <Outlet /> : <div className="onboarding-step">{formMarkup}</div>}
      {youtubePopupEl}
    </CheckpointGate>
  )
}
