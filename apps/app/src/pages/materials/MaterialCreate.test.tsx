import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MaterialCreate } from './MaterialCreate'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))


function renderCreate(client: FakeMaterialClient) {
  return render(
    <MemoryRouter initialEntries={['/materials/new']}>
      <MaterialsProvider client={client}>
        <Routes>
          <Route path="/materials/new" element={<MaterialCreate />} />
          <Route path="/materials/:materialId" element={<div data-testid="detail-page" />} />
          <Route path="/materials" element={<div data-testid="library-page" />} />
        </Routes>
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

describe('MaterialCreate', () => {
  beforeEach(() => {})

  it('requires a title before submitting', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /Plain text/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByText('Give this material a title.')).toBeInTheDocument()
    expect(client.materials).toHaveLength(0)
  })

  it('requires a source for non-manual kinds', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /Web article/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Raft paper' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByText('A source is required for this material type.')).toBeInTheDocument()
    expect(client.materials).toHaveLength(0)
  })

  it('creates a url material and navigates to its detail', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /Web article/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Raft paper' } })
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://raft.github.io/raft.pdf' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.materials).toHaveLength(1)
    })
    expect(client.materials[0]).toMatchObject({
      title: 'Raft paper',
      kind: 'url',
      source: 'https://raft.github.io/raft.pdf',
      ingestionState: 'pending',
      archived: false,
    })
  })

  it('creates a contentless manual material with an empty source', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /Plain text/i }))
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Design notes (planning only)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.materials[0].source).toBe('')
    })
    expect(client.materials[0].kind).toBe('manual')
  })

  it('shows a submit error banner when creation fails', async () => {
    const client = new FakeMaterialClient([])
    client.createMaterial = async () => {
      throw new Error('conflict on client id')
    }
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /Web article/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Raft paper' } })
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://raft.github.io/' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByText('Could not add material')).toBeInTheDocument()
    expect(screen.getByText('conflict on client id')).toBeInTheDocument()
  })

  it('uploads a file, completes the upload, and navigates to detail', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)
    const pdf = new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' })

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [pdf] } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.uploadCalls).toHaveLength(1)
    })
    expect(client.uploadCalls[0].file.name).toBe('paper.pdf')
    expect(client.materials[0]).toMatchObject({
      kind: 'file',
      source: 'paper.pdf',
      uploadCompleteAt: expect.any(String),
    })
  })

  it('marks the material failed when the upload fails and still navigates', async () => {
    const client = new FakeMaterialClient([])
    client.uploadError = new Error('network down')
    renderCreate(client)
    const pdf = new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' })

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [pdf] } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.materials[0].ingestionState).toBe('failed')
    })
    expect(client.materials[0].ingestionError).toContain('Upload failed')
    expect(client.markFailedCalls).toHaveLength(1)
  })

  it('does not complete the upload when the upload failed', async () => {
    const client = new FakeMaterialClient([])
    client.uploadError = new Error('network down')
    client.completeError = new Error('must not be called')
    renderCreate(client)
    const pdf = new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' })

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [pdf] } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.materials[0].ingestionState).toBe('failed')
    })
    expect(client.completeCalls).toEqual([])
  })

  it('marks the material failed when the completion RPC fails', async () => {
    const client = new FakeMaterialClient([])
    client.completeError = new Error('rpc denied')
    renderCreate(client)
    const pdf = new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' })

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [pdf] } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument()
    await waitFor(() => {
      expect(client.materials[0].ingestionState).toBe('failed')
    })
    expect(client.completeCalls).toEqual([client.materials[0].id])
    expect(client.markFailedCalls).toHaveLength(1)
    expect(client.materials[0].ingestionError).toContain('Upload failed')
  })

  it('requires a PDF file for the file source', async () => {
    const client = new FakeMaterialClient([])
    renderCreate(client)

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No file yet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByText('Choose a PDF file to upload.')).toBeInTheDocument()
    expect(client.materials).toHaveLength(0)
  })

  it('disables the submit button while the upload is in flight', async () => {
    const client = new FakeMaterialClient([])
    let resolveUpload: (() => void) | null = null
    vi.spyOn(client, 'uploadMaterialFile').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve
        }),
    )
    renderCreate(client)
    const pdf = new File(['%PDF-1.4'], 'paper.pdf', { type: 'application/pdf' })

    fireEvent.click(await screen.findByRole('button', { name: /PDF document/i }))
    fireEvent.change(screen.getByLabelText('PDF file'), { target: { files: [pdf] } })
    fireEvent.click(screen.getByRole('button', { name: 'Add and process' }))

    expect(await screen.findByRole('button', { name: 'Add and process' })).toBeDisabled()

    await waitFor(() => {
      resolveUpload?.()
    })
  })
})
