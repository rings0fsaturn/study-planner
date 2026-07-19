import { useRef, useState, useCallback, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ROLE_TO_LABEL, LABEL_TO_ROLE } from '@study-tracker/roadmap-engine'
import { useOnboarding, type OnboardingMaterial, type PlaylistEntry } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import { MaterialRow } from '../components/MaterialRow'
import { Step3Preview } from './Step3Preview'
import { useMatchMedia } from '../../lib/useMatchMedia'
import { useMetadataFetcher } from '../MetadataFetcherContext'
import { classifyUrl, extractYouTubeVideoId, extractYouTubePlaylistId } from '../url-classifier'
import { YouTubePopup } from '../components/YouTubePopup'
import { PlaylistPickerPopup } from '../components/PlaylistPickerPopup'
import { PlaylistLoadingPopup } from '../components/PlaylistLoadingPopup'
import { PasteAnimation } from '../components/PasteAnimation'
import { useOnboardingNavigate } from '../useOnboardingNavigate'

const ROLE_LABEL_OPTIONS: string[] = ['Main reading', 'Foundations', 'Practice']

function formatDuration(minutes: number): string {
  if (minutes <= 0) return 'Needs time'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function materialIcon(material: Pick<OnboardingMaterial, 'kind'>): { className: string; label: string } {
  if (material.kind === 'youtube') return { className: 'material-icon yt', label: 'YT' }
  if (material.kind === 'article') return { className: 'material-icon art', label: 'ART' }
  return { className: 'material-icon bk', label: 'BK' }
}

function playlistDuration(playlist: PlaylistEntry): number {
  return playlist.videos
    .filter((video) => video.selected)
    .reduce((sum, video) => sum + video.durationMinutes, 0)
}

export function Step3Materials() {
  const { state, dispatch, expandedMaterials } = useOnboarding()
  const navigate = useOnboardingNavigate()
  const location = useLocation()
  const isDesktop = useMatchMedia('(min-width: 1024px)')
  const isPreviewRoute = location.pathname.includes('/preview')
  const metadataFetcher = useMetadataFetcher()
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [youtubePopupMaterialId, setYoutubePopupMaterialId] = useState<string | null>(null)
  const [playlistPickerId, setPlaylistPickerId] = useState<string | null>(null)
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null)
  const [openMaterialIds, setOpenMaterialIds] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [pasteAnimKey, setPasteAnimKey] = useState(0)
  const [lastPastedUrl, setLastPastedUrl] = useState('')
  const youtubePopupMaterial = youtubePopupMaterialId ? state.materials.find(m => m.id === youtubePopupMaterialId) : null
  const playlistPicker = playlistPickerId ? state.playlists.find(p => p.id === playlistPickerId) : null
  const loadingPlaylist = loadingPlaylistId ? state.playlists.find(p => p.id === loadingPlaylistId) : null

  const handleAdd = () => {
    dispatch({
      type: 'ADD_MATERIAL',
      material: {
        id: crypto.randomUUID(),
        title: '',
        estimatedDuration: 0,
        role: 'foundation',
        url: undefined,
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
  const handlePlaylistRoleChange = (playlistId: string, label: string) => {
    const role = LABEL_TO_ROLE[label]
    if (role) dispatch({ type: 'PLAYLIST_SET_ROLE', playlistId, role })
  }
  const toggleMaterialOpen = (id: string) => {
    setOpenMaterialIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const handleBack = () => navigate('/onboarding/2')
  const handleBuildPlan = () => {
    dispatch({ type: 'SET_STEP_REACHED', step: 3 })
    navigate('/onboarding/3/preview')
  }

  const materialsWithTitle = expandedMaterials.filter(m => m.title && m.estimatedDuration > 0)
  const totalMinutes = materialsWithTitle.reduce((s, m) => s + m.estimatedDuration, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalMinsRemainder = totalMinutes % 60
  const materialGroups = useMemo(() => {
    const groups: Array<{
      key: string
      title: string
      iconClass: string
      iconLabel: string
      materials: OnboardingMaterial[]
    }> = [
      { key: 'videos', title: 'Videos', iconClass: 'material-icon yt', iconLabel: 'YT', materials: state.materials.filter(m => m.kind === 'youtube') },
      { key: 'articles', title: 'Links & articles', iconClass: 'material-icon art', iconLabel: 'ART', materials: state.materials.filter(m => m.kind === 'article') },
      { key: 'manual', title: 'Manual', iconClass: 'material-icon bk', iconLabel: 'BK', materials: state.materials.filter(m => m.kind === 'manual') },
    ]
    return groups.filter(group => group.materials.length > 0)
  }, [state.materials])

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
          <div className="material-groups">
            {state.playlists.length > 0 && (
              <section className="material-group">
                <button
                  type="button"
                  className="material-group-head"
                  aria-expanded={!collapsedGroups.has('playlists')}
                  onClick={() => toggleGroupCollapsed('playlists')}
                >
                  <div className="material-icon pl group-icon">PL</div>
                  <span className="material-group-title">Playlists</span>
                  <span className="material-group-count">
                    {state.playlists.length} · {formatDuration(state.playlists.reduce((sum, playlist) => sum + playlistDuration(playlist), 0))}
                  </span>
                  <svg className="icon icon-sm material-group-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {!collapsedGroups.has('playlists') && (
                <div className="material-compact-list">
                  {[...state.playlists].sort((a, b) => a.additionOrder - b.additionOrder).map((playlist) => {
                    const selectedCount = playlist.videos.filter(video => video.selected).length
                    const duration = playlistDuration(playlist)
                    const canOpenPicker = playlist.fetchStatus === 'success'
                    return (
                      <div
                        key={playlist.id}
                        className="material-compact-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (playlist.fetchStatus === 'loading') setLoadingPlaylistId(playlist.id)
                          if (canOpenPicker) setPlaylistPickerId(playlist.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          if (playlist.fetchStatus === 'loading') setLoadingPlaylistId(playlist.id)
                          if (canOpenPicker) setPlaylistPickerId(playlist.id)
                        }}
                      >
                        <div className="material-icon pl">PL</div>
                        <div className="material-compact-body">
                          <div className="material-title">{playlist.title || 'Loading playlist...'}</div>
                          <div className="material-meta">
                            {playlist.fetchStatus === 'success'
                              ? `${selectedCount} of ${playlist.videos.length} videos · ${formatDuration(duration)}`
                              : playlist.fetchStatus === 'loading'
                                ? 'Fetching playlist details'
                                : 'Failed to load playlist details'}
                          </div>
                        </div>
                        {playlist.fetchStatus === 'success' && !playlist.confirmed && (
                          <span className="material-badge-attention">Needs attention</span>
                        )}
                        {playlist.confirmed && (
                          <select
                            className="field material-compact-role"
                            value={ROLE_TO_LABEL[playlist.role]}
                            onClick={event => event.stopPropagation()}
                            onChange={event => handlePlaylistRoleChange(playlist.id, event.target.value)}
                          >
                            {ROLE_LABEL_OPTIONS.map(label => <option key={label} value={label}>{label}</option>)}
                          </select>
                        )}
                        <button
                          className="material-row-action"
                          onClick={event => { event.stopPropagation(); handlePlaylistRemove(playlist.id) }}
                          title="Remove playlist"
                        >
                          <svg className="icon icon-sm" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
                )}
              </section>
            )}

            {materialGroups.map((group) => (
              <section key={group.key} className="material-group">
                <button
                  type="button"
                  className="material-group-head"
                  aria-expanded={!collapsedGroups.has(group.key)}
                  onClick={() => toggleGroupCollapsed(group.key)}
                >
                  <div className={`${group.iconClass} group-icon`}>{group.iconLabel}</div>
                  <span className="material-group-title">{group.title}</span>
                  <span className="material-group-count">
                    {group.materials.length} · {formatDuration(group.materials.reduce((sum, material) => sum + material.estimatedDuration, 0))}
                  </span>
                  <svg className="icon icon-sm material-group-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {!collapsedGroups.has(group.key) && (
                <div className="material-compact-list">
                  {[...group.materials].sort((a, b) => a.additionOrder - b.additionOrder).map((material) => {
                    const icon = materialIcon(material)
                    const isOpen = openMaterialIds.has(material.id) || !material.title || material.estimatedDuration <= 0 || material.fetchStatus === 'partial' || material.fetchStatus === 'error'
                    return (
                      <div key={material.id} className={`material-compact-item${isOpen ? ' open' : ''}`}>
                        <div
                          className="material-compact-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleMaterialOpen(material.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleMaterialOpen(material.id)
                            }
                          }}
                        >
                          <div className={icon.className}>{icon.label}</div>
                          <div className="material-compact-body">
                            <div className="material-title">{material.title || 'Untitled material'}</div>
                            <div className="material-meta">
                              {formatDuration(material.estimatedDuration)} · {ROLE_TO_LABEL[material.role]}
                            </div>
                          </div>
                          <span className="tag tag-sm">{ROLE_TO_LABEL[material.role]}</span>
                          <svg className="icon icon-sm material-compact-chevron" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                        {isOpen && (
                          <div className="material-compact-edit">
                            <MaterialRow
                              material={material}
                              existingMaterials={state.materials}
                              onUpdate={updates => handleUpdate(material.id, updates)}
                              onRemove={() => handleRemove(material.id)}
                              onClickCard={material.kind === 'youtube' && material.youtubeVideoId && material.fetchStatus === 'success'
                                ? () => setYoutubePopupMaterialId(material.id)
                                : undefined}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                )}
              </section>
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
  const playlistPickerEl = playlistPicker ? (
    <PlaylistPickerPopup
      playlistTitle={playlistPicker.title}
      videos={playlistPicker.videos}
      onConfirm={(selectedVideoIds) => {
        handlePlaylistConfirm(playlistPicker.id, selectedVideoIds)
        setPlaylistPickerId(null)
      }}
      onCancel={() => setPlaylistPickerId(null)}
    />
  ) : null
  const playlistLoadingEl = loadingPlaylist ? (
    <PlaylistLoadingPopup onClose={() => setLoadingPlaylistId(null)} />
  ) : null

  if (isDesktop) {
    return (
      <CheckpointGate step={3}>
        <div className="onboarding-step onboarding-materials-grid">
          <div className="onboarding-materials-form">{formMarkup}</div>
          <div className="onboarding-materials-preview-slot">
            <div className="mono-caps onboarding-materials-preview-label">Your plan · updates as you add</div>
            <Step3Preview />
          </div>
        </div>
        {youtubePopupEl}
        {playlistPickerEl}
        {playlistLoadingEl}
      </CheckpointGate>
    )
  }

  return (
    <CheckpointGate step={3}>
      {isPreviewRoute ? <Outlet /> : <div className="onboarding-step">{formMarkup}</div>}
      {youtubePopupEl}
      {playlistPickerEl}
      {playlistLoadingEl}
    </CheckpointGate>
  )
}
