import { useNavigate, useLocation } from 'react-router-dom'
import { useOnboarding, type OnboardingMaterial } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import { MaterialRow } from '../components/MaterialRow'
import { Step3Preview } from './Step3Preview'
import '../onboarding.css'

export function Step3Materials() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  const isPreviewRoute = location.pathname.includes('/preview')

  const handleAdd = () => {
    dispatch({ type: 'ADD_MATERIAL', material: {
      id: crypto.randomUUID(), title: '', estimatedDuration: 0,
      role: 'foundation', url: undefined, additionOrder: state.materials.length, userOverrodeType: false,
    }})
  }
  const handleUpdate = (id: string, updates: Partial<OnboardingMaterial>) => dispatch({ type: 'UPDATE_MATERIAL', id, updates })
  const handleRemove = (id: string) => dispatch({ type: 'REMOVE_MATERIAL', id })
  const handleBack = () => navigate('/onboarding/2')

  const materialsWithTitle = state.materials.filter(m => m.title && m.estimatedDuration > 0)
  const totalMinutes = materialsWithTitle.reduce((s, m) => s + m.estimatedDuration, 0)

  const formContent = (
    <div>
      <h1 className="screen-h1" style={{ marginBottom: '8px' }}>
        What are you <em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>studying</em>?
      </h1>
      <p className="screen-lead" style={{ marginBottom: '20px' }}>Paste links, or add things by hand.</p>
      <div className="field-group" style={{ marginBottom: '12px' }}>
        <label className="field-label">Paste a URL</label>
        <input className="field" type="url" placeholder="youtube.com/… or any article link" disabled />
        <div className="field-helper">URL paste is coming soon — add materials manually below.</div>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }} onClick={handleAdd}>
        <svg className="icon icon-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add manually
      </button>
      {state.materials.length > 0 && (
        <>
          <div className="mono-caps" style={{ marginBottom: '8px' }}>
            {materialsWithTitle.length} added · ~{Math.round(totalMinutes / 60)}h {totalMinutes % 60}m
          </div>
          <div className="material-list" style={{ marginBottom: '16px' }}>
            {state.materials.map(mat => (
              <MaterialRow key={mat.id} material={mat} existingMaterials={state.materials}
                onUpdate={updates => handleUpdate(mat.id, updates)}
                onRemove={() => handleRemove(mat.id)} />
            ))}
          </div>
        </>
      )}
      <div className="row" style={{ gap: '8px' }}>
        <button className="btn btn-secondary" onClick={handleBack}>
          <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        {!isDesktop && (
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
            disabled={materialsWithTitle.length === 0}
            onClick={() => { dispatch({ type: 'SET_STEP_REACHED', step: 3 }); navigate('/onboarding/3/preview') }}>
            Build my plan
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        )}
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <CheckpointGate step={3}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          <div>{formContent}</div>
          <div>
            <div className="mono-caps" style={{ marginBottom: '12px' }}>Live preview · updates as you add</div>
            <Step3Preview />
          </div>
        </div>
      </CheckpointGate>
    )
  }

  return (
    <CheckpointGate step={3}>
      {!isPreviewRoute ? formContent : <Step3Preview />}
    </CheckpointGate>
  )
}