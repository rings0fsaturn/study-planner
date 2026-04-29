import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startOfToday, addWeeks, addMonths, format, isBefore } from 'date-fns'
import { useOnboarding } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import '../onboarding.css'

const TODAY = startOfToday()
const TODAY_ISO = format(TODAY, 'yyyy-MM-dd')

const CHIPS = [
  { label: 'In 2 weeks', getDate: () => format(addWeeks(TODAY, 2), 'yyyy-MM-dd') },
  { label: 'In 1 month', getDate: () => format(addMonths(TODAY, 1), 'yyyy-MM-dd') },
  { label: 'In 2 months', getDate: () => format(addMonths(TODAY, 2), 'yyyy-MM-dd') },
  { label: 'In 3 months', getDate: () => format(addMonths(TODAY, 3), 'yyyy-MM-dd') },
  { label: 'In 6 months', getDate: () => format(addMonths(TODAY, 6), 'yyyy-MM-dd') },
]

export function Step1Deadline() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const [deadline, setDeadline] = useState(state.deadline ?? '')
  const [purpose, setPurpose] = useState(state.purpose ?? '')
  const [selectedChip, setSelectedChip] = useState<string | null>(null)

  const handleChipClick = (chip: typeof CHIPS[number]) => {
    setDeadline(chip.getDate())
    setSelectedChip(chip.label)
  }

  const handleContinue = () => {
    if (!deadline || isBefore(deadline, TODAY_ISO)) return
    dispatch({ type: 'SET_DEADLINE', deadline, purpose })
    dispatch({ type: 'SET_STEP_REACHED', step: 1 })
    navigate('/onboarding/2')
  }

  return (
    <CheckpointGate step={1}>
      <div>
        <h1 className="screen-h1" style={{ marginBottom: '12px' }}>
          When do you need to be <em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>done</em>?
        </h1>
        <p className="screen-lead" style={{ marginBottom: '24px' }}>
          A real date or a rough one — we'll work backwards from it.
        </p>
            <div className="field-group" style={{ marginBottom: '12px' }}>
              <label htmlFor="target-date" className="field-label">Target date</label>
              <input
                id="target-date"
                className="field"
                type="date"
                min={TODAY_ISO}
                value={deadline}
                onChange={e => { setDeadline(e.target.value); setSelectedChip(null) }}
              />
            </div>
        <div className="chip-row" style={{ marginBottom: '24px' }}>
          {CHIPS.map(chip => (
            <button
              key={chip.label}
              className={`chip ${selectedChip === chip.label ? 'selected' : ''}`}
              onClick={() => handleChipClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
            <div className="field-group" style={{ marginBottom: '8px' }}>
              <label htmlFor="purpose" className="field-label">
                What are you preparing for?{' '}
                <span style={{ color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)' }}>(optional)</span>
              </label>
              <input
                id="purpose"
                className="field"
                type="text"
                placeholder="e.g. System design interview"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
              />
            </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: '24px' }} onClick={handleContinue} disabled={!deadline}>
          Continue
          <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </CheckpointGate>
  )
}