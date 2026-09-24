import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { HttpGuideClient, type GuideClientLike } from './guideClient'

interface GuideContextValue {
  client: GuideClientLike
}

const GuideContext = createContext<GuideContextValue | null>(null)

function defaultClient(): HttpGuideClient {
  const tokenProvider = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }
  return new HttpGuideClient(tokenProvider)
}

interface GuideProviderProps {
  children: ReactNode
  client?: GuideClientLike
}

export function GuideProvider({ children, client }: GuideProviderProps) {
  const value = useMemo(() => ({ client: client ?? defaultClient() }), [client])
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
}

export function useGuideClient(): GuideClientLike {
  const context = useContext(GuideContext)
  if (!context) {
    throw new Error('useGuideClient must be used within GuideProvider')
  }
  return context.client
}
