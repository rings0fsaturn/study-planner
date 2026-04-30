import type { Slot } from '@study-tracker/progress-engine'
import type { OnboardingSlotEdit } from '../OnboardingProvider'

function upsertEdit(edits: OnboardingSlotEdit[], edit: OnboardingSlotEdit): void {
  const idx = edits.findIndex(e => e.weekIndex === edit.weekIndex && e.dayOfWeek === edit.dayOfWeek)
  if (idx >= 0) {
    edits[idx] = edit
  } else {
    edits.push(edit)
  }
}

export function computeSwapEdits(
  sourceSlot: Slot,
  destSlot: Slot,
  existingEdits: OnboardingSlotEdit[],
): OnboardingSlotEdit[] {
  const edits = [...existingEdits.map(e => ({ ...e }))]

  const sourceContent = {
    materialId: sourceSlot.candidateMaterialIds.length === 1 ? sourceSlot.candidateMaterialIds[0] : null,
    sessionTitle: sourceSlot.sessionTitle,
    plannedMinutes: sourceSlot.plannedMinutes,
  }

  const destContent = {
    materialId: destSlot.candidateMaterialIds.length === 1 ? destSlot.candidateMaterialIds[0] : null,
    sessionTitle: destSlot.sessionTitle,
    plannedMinutes: destSlot.plannedMinutes,
  }

  upsertEdit(edits, {
    weekIndex: destSlot.weekIndex,
    dayOfWeek: destSlot.dayOfWeek,
    materialId: sourceContent.materialId,
    sessionTitle: sourceContent.sessionTitle,
    plannedMinutes: sourceContent.plannedMinutes,
  })

  upsertEdit(edits, {
    weekIndex: sourceSlot.weekIndex,
    dayOfWeek: sourceSlot.dayOfWeek,
    materialId: destContent.materialId,
    sessionTitle: destContent.sessionTitle,
    plannedMinutes: destContent.plannedMinutes,
  })

  return edits
}
