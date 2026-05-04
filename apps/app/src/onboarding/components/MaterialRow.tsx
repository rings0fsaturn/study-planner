import { useEffect } from 'react'
import { inferRole, ROLE_TO_LABEL, LABEL_TO_ROLE } from '@study-tracker/roadmap-engine'
import type { OnboardingMaterial } from '../OnboardingProvider'

const ROLE_LABEL_OPTIONS: string[] = ['Main reading', 'Foundations', 'Practice']

const ICON_CONFIG: Record<string, { className: string; label: string }> = {
  youtube: { className: 'material-icon yt', label: 'YT' },
  article: { className: 'material-icon art', label: 'ART' },
  manual: { className: 'material-icon bk', label: 'BK' },
}

interface MaterialRowProps {
  material: OnboardingMaterial
  existingMaterials: OnboardingMaterial[]
  onUpdate: (updates: Partial<OnboardingMaterial>) => void
  onRemove: () => void
  onClickCard?: () => void
}

export function MaterialRow({ material, existingMaterials, onUpdate, onRemove, onClickCard }: MaterialRowProps) {
  useEffect(() => {
    if (material.userOverrodeType) return
    if (!material.title || material.estimatedDuration <= 0) return
    const existingAsMaterials = existingMaterials
      .filter(m => m.id !== material.id && m.estimatedDuration > 0)
      .map(m => ({ id: m.id, title: m.title, totalMinutes: m.estimatedDuration, role: m.role, additionOrder: m.additionOrder }))
    const inferred = inferRole(
      material.title,
      material.estimatedDuration,
      existingAsMaterials,
    )
    if (inferred !== material.role) {
      onUpdate({ role: inferred })
    }
  }, [material.title, material.estimatedDuration, existingMaterials, material.userOverrodeType, material.role, onUpdate])

  const handleRoleChange = (label: string) => {
    const role = LABEL_TO_ROLE[label]
    if (role) onUpdate({ role, userOverrodeType: true })
  }

  const icon = ICON_CONFIG[material.kind] ?? ICON_CONFIG.manual
  const isLoading = material.fetchStatus === 'loading'
  const isError = material.fetchStatus === 'error'
  const isPartial = material.fetchStatus === 'partial'
  const isClickable = material.kind === 'youtube' && material.youtubeVideoId && !isLoading

  return (
    <div className={`material-row${isLoading ? ' loading' : ''}`}>
      <div
        className={icon.className}
        onClick={isClickable ? onClickCard : undefined}
        style={isClickable ? { cursor: 'pointer' } : undefined}
      >
        {icon.label}
      </div>
      <div className="material-body">
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="shimmer-line medium" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="shimmer-line short" style={{ flex: 1 }} />
              <div className="shimmer-line short" style={{ flex: 1 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input className={`field${isPartial && !material.title ? ' has-error' : ''}`} type="text" placeholder="Material title"
              value={material.title}
              onChange={e => onUpdate({ title: e.target.value })} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="field-with-suffix" style={{ flex: 1 }}>
                <input className={`field${isPartial && !material.estimatedDuration ? ' has-error' : ''}`} type="number" min={1} placeholder="Min"
                  value={material.estimatedDuration || ''}
                  onChange={e => onUpdate({ estimatedDuration: Number(e.target.value) })} />
                <span className="field-with-suffix-text">min</span>
              </div>
              <select className="field" style={{ flex: 1 }}
                value={ROLE_TO_LABEL[material.role]}
                onChange={e => handleRoleChange(e.target.value)}>
                {ROLE_LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {material.kind === 'manual' && (
              <input className="field" type="url" placeholder="URL (optional)"
                value={material.url ?? ''}
                onChange={e => onUpdate({ url: e.target.value || undefined })} />
            )}
            {isError && (
              <div className="field-helper error">We couldn't fetch details. Please enter them manually.</div>
            )}
            {isPartial && (
              <div className="field-helper error">Please fill in the missing field.</div>
            )}
          </div>
        )}
        {!isLoading && material.estimatedDuration > 0 && material.title && (
          <div className="material-meta" style={{ marginTop: '6px' }}>
            ~{material.estimatedDuration}min · {ROLE_TO_LABEL[material.role]}
          </div>
        )}
      </div>
      <button className="material-row-action" onClick={onRemove} title="Remove material">
        <svg className="icon icon-sm" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
