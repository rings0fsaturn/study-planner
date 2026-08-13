import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { MaterialClient, type MaterialClientLike, type MaterialTableLike } from './materialClient'

interface MaterialsContextValue {
  client: MaterialClientLike
}

const MaterialsContext = createContext<MaterialsContextValue | null>(null)

function defaultClient(): MaterialClient {
  return new MaterialClient(supabase as unknown as MaterialTableLike)
}

interface MaterialsProviderProps {
  children: ReactNode
  client?: MaterialClientLike
}

export function MaterialsProvider({ children, client }: MaterialsProviderProps) {
  const value = useMemo(
    () => ({ client: client ?? defaultClient() }),
    [client],
  )
  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>
}

export function useMaterialsClient(): MaterialClientLike {
  const context = useContext(MaterialsContext)
  if (!context) {
    throw new Error('useMaterialsClient must be used within MaterialsProvider')
  }
  return context.client
}
