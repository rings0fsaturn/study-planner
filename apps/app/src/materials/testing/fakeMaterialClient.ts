import { MaterialServiceError, type MaterialRecord } from '../types'

/** In-memory MaterialClient double for component tests. */
export class FakeMaterialClient {
  materials: MaterialRecord[]

  constructor(materials: MaterialRecord[] = []) {
    this.materials = materials.map((material) => ({ ...material }))
  }

  async listMaterials(options: {
    includeArchived?: boolean
    status?: string
    search?: string
  } = {}): Promise<MaterialRecord[]> {
    let list = this.materials.filter((material) => options.includeArchived || !material.archived)
    if (options.status && options.status !== 'all') {
      list = list.filter((material) => material.ingestionState === options.status)
    }
    if (options.search && options.search.trim() !== '') {
      const query = options.search.trim().toLowerCase()
      list = list.filter((material) => material.title.toLowerCase().includes(query))
    }
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getMaterial(id: string): Promise<MaterialRecord> {
    const material = this.materials.find((m) => m.id === id)
    if (!material) throw new MaterialServiceError('not_found', 'material not found')
    return { ...material }
  }

  async createMaterial(input: {
    clientId: string
    title: string
    kind: MaterialRecord['kind']
    source: string
    estimatedMinutes?: number | null
  }): Promise<MaterialRecord> {
    const now = new Date().toISOString()
    const record: MaterialRecord = {
      id: `mat-${this.materials.length + 1}`,
      ownerId: 'user-a',
      title: input.title,
      kind: input.kind,
      source: input.source,
      ingestionState: 'pending',
      ingestionProgress: 0,
      ingestionError: null,
      archived: false,
      contentVersion: `v-${now}`,
      replacedAt: null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.materials.push(record)
    return { ...record }
  }

  async archiveMaterial(id: string): Promise<void> {
    this.patch(id, { archived: true })
  }

  async restoreMaterial(id: string): Promise<void> {
    this.patch(id, { archived: false })
  }

  async replaceMaterial(
    id: string,
    input: {
      title: string
      kind: MaterialRecord['kind']
      source: string
      estimatedMinutes?: number | null
    },
  ): Promise<void> {
    this.patch(id, {
      title: input.title,
      kind: input.kind,
      source: input.source,
      estimatedMinutes: input.estimatedMinutes ?? null,
      ingestionState: 'pending',
      ingestionProgress: 0,
      ingestionError: null,
      replacedAt: new Date().toISOString(),
      contentVersion: `v-${Date.now()}`,
    })
  }

  async retryIngestion(id: string): Promise<void> {
    this.patch(id, {
      ingestionState: 'pending',
      ingestionProgress: 0,
      ingestionError: null,
    })
  }

  async deleteMaterial(id: string): Promise<void> {
    const index = this.materials.findIndex((m) => m.id === id)
    if (index === -1) throw new MaterialServiceError('not_found', 'material not found')
    this.materials.splice(index, 1)
  }

  private patch(id: string, updates: Partial<MaterialRecord>): void {
    const material = this.materials.find((m) => m.id === id)
    if (!material) throw new MaterialServiceError('not_found', 'material not found')
    Object.assign(material, updates, { updatedAt: new Date().toISOString() })
  }
}
