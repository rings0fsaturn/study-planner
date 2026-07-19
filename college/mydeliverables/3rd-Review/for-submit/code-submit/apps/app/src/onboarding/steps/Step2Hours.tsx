import { useState } from 'react'
import type { DayOfWeek } from '@study-tracker/roadmap-engine'
import { useOnboarding } from '../OnboardingProvider'
import { CheckpointGate } from '../CheckpointGate'
import { useOnboardingNavigate } from '../useOnboardingNavigate'

const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_CHIPS = [2, 4, 6, 8, 10, 15, 20]

export function Step2Hours() {
  const { state, dispatch } = useOnboarding()
  const navigate = useOnboardingNavigate()
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
    const wd = Math.round(h * 0.6)
    setWeekdayHours(wd)
    setWeekendHours(h - wd)
  }

  const handleBack = () => navigate('/onboarding/1')
  const handleContinue = () => {
    if (!canContinue) return
    dispatch({
      type: 'SET_HOURS',
      weeklyHours,
      weekdayHours,
      weekendHours,
      selectedStudyDays: selectedDays,
    })
    dispatch({ type: 'SET_STEP_REACHED', step: 2 })
    navigate('/onboarding/3')
  }

  return (
    <CheckpointGate step={2}>
      <div className="onboarding-step">
        <h1 className="onboarding-h1">
          How many <em>hours</em> a week?
        </h1>
        <p className="onboarding-lead">
          Be honest. We'd rather underestimate and let you exceed than the other way.
        </p>

        <div className="onboarding-hours-display">
          <span className="onboarding-hours-number">{weeklyHours}</span>
          <span className="onboarding-hours-suffix">h / wk</span>
          <div className="mono-caps onboarding-hours-sublabel">
            {weeklyHours > 0
              ? `≈ ${Math.floor((weeklyHours * 60) / 7 / 60)}h ${Math.round((weeklyHours * 60) / 7 % 60)}m a day`
              : 'Pick a starting point'}
          </div>
        </div>

        <div className="chip-row" style={{ justifyContent: 'center' }}>
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

        <div className="onboarding-hours-split">
          <div className="field-group">
            <label htmlFor="weekday-hours" className="field-label">Weekday hours</label>
            <input
              id="weekday-hours"
              className="field"
              type="number"
              min={0}
              value={weekdayHours}
              onChange={e => { setWeekdayHours(Number(e.target.value)); setSelectedChip(null) }}
            />
          </div>
          <div className="field-group">
            <label htmlFor="weekend-hours" className="field-label">Weekend hours</label>
            <input
              id="weekend-hours"
              className="field"
              type="number"
              min={0}
              value={weekendHours}
              onChange={e => { setWeekendHours(Number(e.target.value)); setSelectedChip(null) }}
            />
          </div>
        </div>

        {!hoursMatch && weeklyHours > 0 && (
          <div className="field-helper error">
            Weekday + weekend must equal {weeklyHours}h total. Currently {weekdayHours + weekendHours}h.
          </div>
        )}

        <div className="field-group">
          <label className="field-label">Study days</label>
          <div className="chip-row">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day}
                className={`chip ${selectedDays.includes(day) ? 'selected' : ''}`}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="onboarding-spacer" />

        <div className="onboarding-actions">
          <button className="btn btn-secondary onboarding-back-btn" onClick={handleBack} aria-label="Back">
            <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <button
            className="btn btn-primary btn-lg onboarding-continue-btn"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continue
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}
