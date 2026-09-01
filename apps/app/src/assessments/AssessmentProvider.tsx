import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  AssessmentClient,
  HttpAssessmentFetch,
  type AssessmentClientLike,
} from './assessmentClient'

interface AssessmentContextValue {
  client: AssessmentClientLike
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null)

function defaultClient(): AssessmentClient {
  const tokenProvider = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }
  return new AssessmentClient(new HttpAssessmentFetch(tokenProvider))
}

interface AssessmentProviderProps {
  children: ReactNode
  client?: AssessmentClientLike
}

export function AssessmentProvider({ children, client }: AssessmentProviderProps) {
  const value = useMemo(() => ({ client: client ?? defaultClient() }), [client])
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>
}

export function useAssessmentClient(): AssessmentClientLike {
  const context = useContext(AssessmentContext)
  if (!context) {
    throw new Error('useAssessmentClient must be used within AssessmentProvider')
  }
  return context.client
}