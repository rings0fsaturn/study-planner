import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DayOfWeek } from '@study-tracker/progress-engine'
import { useOnboarding } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import '../onboarding.css'

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_CHIPS = [2, 4, 6, 8, 10, 15, 20]

export function Step2Hours() {
  const { state, dispatch } = useOnboarding()
  const navigate = useNavigate()
  const [weeklyHours, setWeeklyHours] = useState(state.weeklyHours || 0)
  const [weekdayHours, setWeekdayHours] = useState(state.weekdayHours || 0)
  const [weekendHours, setWeekendHours] = useState(state.weekendHours || 0)
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(state.selectedStudyDays)
  const [selectedChip, setSelectedChip] = useState<number | null>(null)

  const hoursMatch = weekdayHours + weekendHours === weeklyHours
  const canContinue = weeklyHours > 0 && selectedDays.length > 0 && hoursMatch

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleChipClick = (h: number) => {
    setWeeklyHours(h)
    setSelectedChip(h)
    setWeekdayHours(Math.round(h * 0.6))
    setWeekendHours(h - Math.round(h * 0.6))
  }

  const handleBack = () => navigate('/onboarding/1')
  const handleContinue = () => {
    if (canContinue) {
      dispatch({ type: 'SET_HOURS', weeklyHours, weekdayHours, weekendHours, selectedStudyDays: selectedDays })
      dispatch({ type: 'SET_STEP_REACHED', step: 2 })
      navigate('/onboarding/3')
    }
  }

  return (
    <CheckpointGate step={2}>
      <div>
        <h1 className="screen-h1" style={{ marginBottom: '12px' }}>
          How many <em style={{ fontStyle: 'italic', color: 'var(--terracotta)', fontWeight: 400 }}>hours</em> a week?
        </h1>
        <p className="screen-lead" style={{ marginBottom: '32px' }}>
          Be honest. We'd rather underestimate and let you exceed than the other way.
        </p>
        <div style={{ textAlign: 'center', margin: '24px 0 32px' }}>
          <div className="stat-value lg" style={{ display: 'inline-block' }}>{weeklyHours}</div>
          <div className="stat-label" style={{ marginTop: '6px' }}>hours per week</div>
        </div>
        <div className="chip-row" style={{ marginBottom: '24px', justifyContent: 'center' }}>
          {HOUR_CHIPS.map(h => (
            <button
              key={h}
              className={`chip ${selectedChip === h ? 'selected' : ''}`}
              onClick={() => handleChipClick(h)}
            >
              {h}h{h === 20 ? '+' : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div className="field-group">
                <label htmlFor="weekday-hours" className="field-label">Weekday hours</label>
                <input id="weekday-hours" className="field" type="number" min={0} value={weekdayHours}
                  onChange={e => { setWeekdayHours(Number(e.target.value)); setSelectedChip(null) }} />
              </div>
              <div className="field-group">
                <label htmlFor="weekend-hours" className="field-label">Weekend hours</label>
                <input id="weekend-hours" className="field" type="number" min={0} value={weekendHours}
                  onChange={e => { setWeekendHours(Number(e.target.value)); setSelectedChip(null) }} />
              </div>
        </div>
        {!hoursMatch && weeklyHours > 0 && (
          <div className="field-helper error" style={{ marginBottom: '12px' }}>
            Weekday + weekend must equal {weeklyHours}h total. Currently {weekdayHours + weekendHours}h.
          </div>
        )}
        <div className="field-group" style={{ marginBottom: '24px' }}>
          <label className="field-label">Study days</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {DAYS_OF_WEEK.map(day => {
              const checked = selectedDays.includes(day)
              return (
                <button key={day}
                  className={`chip ${checked ? 'selected' : ''}`}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
        <div className="row" style={{ gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleBack}>
            <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={handleContinue} disabled={!canContinue}>
            Continue
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}