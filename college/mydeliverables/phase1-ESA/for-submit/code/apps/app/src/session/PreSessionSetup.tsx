import { useEffect, useMemo, useState } from 'react';
import { ROLE_TO_LABEL } from '@study-tracker/roadmap-engine';
import type { SessionSlotData } from './types';
import type { SessionMaterialOption } from './sessionPlanning';
import { withSelectedMaterial } from './sessionPlanning';
import { SessionDial } from './SessionDial';

interface PreSessionSetupProps {
  initialSlotData?: SessionSlotData;
  materials: SessionMaterialOption[];
  onStart: (slotData: SessionSlotData) => void | Promise<void>;
  onCancel: () => void;
  /** Today's daily study budget in minutes (hoursPerDay × 60). */
  dailyCapacityMinutes?: number;
  /** Minutes already logged today; the soft cap is capacity − done (D5). */
  minutesDoneToday?: number;
  /** Recommended planned length (already clamped to the cap). */
  recommendedMinutes?: number;
}

function formatMinutes(minutes: number): string {
  const mm = Math.max(0, Math.round(minutes));
  if (mm < 60) return `${mm} min`;
  const hours = Math.floor(mm / 60);
  const rest = mm % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Compact duration matching the mock's rec-line ("1h", "2h", "1h 30m"). */
function compactDuration(minutes: number): string {
  const mm = Math.max(0, Math.round(minutes));
  const h = Math.floor(mm / 60);
  const r = mm % 60;
  if (h === 0) return `${r}m`;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function iconFor(kind: SessionMaterialOption['kind']): string {
  if (kind === 'youtube') return 'YT';
  if (kind === 'article') return 'AR';
  return 'NB';
}

function kindLabel(kind: SessionMaterialOption['kind']): string {
  if (kind === 'youtube') return 'YouTube';
  if (kind === 'article') return 'Article';
  return 'Manual';
}

export function PreSessionSetup({
  initialSlotData,
  materials,
  onStart,
  onCancel,
  dailyCapacityMinutes,
  minutesDoneToday = 0,
  recommendedMinutes,
}: PreSessionSetupProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState(
    initialSlotData?.materialId ?? materials[0]?.materialId ?? '',
  );
  const [plannedMinutes, setPlannedMinutes] = useState(initialSlotData?.plannedMinutes ?? 50);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (initialSlotData?.materialId) setSelectedMaterialId(initialSlotData.materialId);
    if (initialSlotData?.plannedMinutes) setPlannedMinutes(initialSlotData.plannedMinutes);
  }, [initialSlotData]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.materialId === selectedMaterialId) ?? materials[0],
    [materials, selectedMaterialId],
  );

  // Fall back to a 2h budget when capacity is unknown so the dial still scales.
  const budgetMinutes = dailyCapacityMinutes && dailyCapacityMinutes > 0 ? dailyCapacityMinutes : 120;
  const capMinutes = Math.max(0, budgetMinutes - minutesDoneToday);
  const recommended = recommendedMinutes ?? initialSlotData?.plannedMinutes ?? 50;
  const startDisabled = !initialSlotData || !selectedMaterial;

  const handleStart = async () => {
    if (!initialSlotData || !selectedMaterial) return;
    await onStart({
      ...withSelectedMaterial(initialSlotData, selectedMaterial),
      plannedMinutes,
      plannedSessionMinutes: plannedMinutes,
    });
  };

  if (!initialSlotData || !selectedMaterial) {
    return (
      <div className="session-layout session-layout-centered">
        <div className="session-frame">
          <div className="session-eyebrow-row eyebrow-faint">Ready to start</div>
          <div className="session-title">Pick something to study</div>
          <div className="session-subtitle">Your material directory is empty for this roadmap.</div>
          <div className="session-actions">
            <button className="btn btn-secondary" onClick={onCancel}>Back home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="session-layout session-layout-centered">
      <div className="session-frame">
        <div className="session-eyebrow-row eyebrow-clay">
          <span className="session-pulse-dot paused" />
          Ready to start
        </div>
        <div className="session-title">{selectedMaterial.title}</div>
        <div className="session-subtitle">
          Suggested for today · {kindLabel(selectedMaterial.kind)} · est ~{formatMinutes(selectedMaterial.remainingEstimatedMinutes || selectedMaterial.estimatedMinutes)}
        </div>

        <div className="material-strip session-setup-strip">
          <div className="material-strip-icon">{iconFor(selectedMaterial.kind)}</div>
          <div className="material-strip-body">
            <div className="material-strip-title">{selectedMaterial.title}</div>
            <div className="material-strip-meta">
              {selectedMaterial.kind.toUpperCase()} · {selectedMaterial.started ? 'in progress' : 'not started'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm session-setup-change" onClick={() => setPickerOpen(true)}>
            Change
          </button>
        </div>

        <div className="rec-line">
          <span className="dot" /> Recommended <strong>{compactDuration(recommended)}</strong>
          {capMinutes > 0 ? ` · within today's ${compactDuration(capMinutes)} cap` : null}
        </div>

        <SessionDial
          budgetMinutes={budgetMinutes}
          doneMinutes={minutesDoneToday}
          recommendedMinutes={recommended}
          value={plannedMinutes}
          onChange={setPlannedMinutes}
        />

        <div className="session-actions">
          <button className="btn btn-accent" onClick={() => void handleStart()} disabled={startDisabled}>
            Start session
          </button>
          <button className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
            Pick a different material
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Choose material" onClick={() => setPickerOpen(false)}>
          <div className="modal-card session-material-picker" onClick={(event) => event.stopPropagation()}>
            <div className="modal-eyebrow">Choose material</div>
            <div className="modal-title">What do you want to study?</div>
            <div className="chooser">
              {materials.map((material) => (
                <button
                  key={material.materialId}
                  className={`chooser-row${material.materialId === selectedMaterial.materialId ? ' sel' : ''}`}
                  onClick={() => setSelectedMaterialId(material.materialId)}
                >
                  <span className="chooser-radio" />
                  <span className="material-strip-icon chooser-icon">{iconFor(material.kind)}</span>
                  <span className="material-strip-body">
                    <span className="material-strip-title">{material.title}</span>
                    <span className="material-strip-meta">
                      {ROLE_TO_LABEL[material.role]} · {material.done ? 'done' : material.started ? 'in progress' : 'not started'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="session-picker-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setPickerOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => setPickerOpen(false)}>Use this material</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
