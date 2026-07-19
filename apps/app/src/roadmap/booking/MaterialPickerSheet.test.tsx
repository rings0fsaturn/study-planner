import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MaterialPickerSheet } from './MaterialPickerSheet'
import type { BookingMaterialOption } from './types'

const materials: BookingMaterialOption[] = [
  {
    materialId: 'mat-1',
    title: 'Linear Algebra playlist',
    kind: 'youtube',
    started: true,
    done: false,
    remainingEstimatedMinutes: 160,
    estimatedMinutes: 240,
    lastPosition: { kind: 'videos', value: 4, ofTotal: 12 },
  },
  {
    materialId: 'mat-2',
    title: 'Strang notes',
    kind: 'article',
    started: false,
    done: false,
    remainingEstimatedMinutes: 35,
    estimatedMinutes: 35,
  },
]

describe('MaterialPickerSheet', () => {
  it('renders the "pick at start" row plus each material with a status subline', () => {
    render(
      <MaterialPickerSheet
        open
        materials={materials}
        selectedMaterialId="mat-1"
        onCancel={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('No material · pick at start')).toBeInTheDocument()
    expect(screen.getByText('Linear Algebra playlist')).toBeInTheDocument()
    expect(screen.getByText('in progress · 4/12 videos')).toBeInTheDocument()
    expect(screen.getByText('not started')).toBeInTheDocument()
  })

  it('commits the selected material on "Use this material"', () => {
    const onSelect = vi.fn()
    render(
      <MaterialPickerSheet
        open
        materials={materials}
        selectedMaterialId="mat-1"
        onCancel={() => {}}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Strang notes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this material' }))
    expect(onSelect).toHaveBeenCalledWith('mat-2')
  })

  it('detaches (null) when "No material · pick at start" is chosen', () => {
    const onSelect = vi.fn()
    render(
      <MaterialPickerSheet
        open
        materials={materials}
        selectedMaterialId="mat-1"
        onCancel={() => {}}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /No material · pick at start/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Use this material' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <MaterialPickerSheet
        open={false}
        materials={materials}
        selectedMaterialId={null}
        onCancel={() => {}}
        onSelect={() => {}}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
