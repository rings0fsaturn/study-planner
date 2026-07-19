import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleMetadataRequest } from './handler.ts'
import { YouTubeDataApiClient } from './youtube-client.ts'
import { ReadabilityExtractor } from './article-extractor.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return Response.json(
      { type: 'error', message: 'Missing authorization' },
      { status: 401, headers: corsHeaders },
    )
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return Response.json(
      { type: 'error', message: 'Unauthorized' },
      { status: 401, headers: corsHeaders },
    )
  }

  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { type: 'error', message: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    )
  }

  if (!body.url || typeof body.url !== 'string') {
    return Response.json(
      { type: 'error', message: 'Missing url field' },
      { status: 400, headers: corsHeaders },
    )
  }

  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')
  if (!youtubeApiKey) {
    return Response.json(
      { type: 'error', message: 'Server misconfigured' },
      { status: 500, headers: corsHeaders },
    )
  }

  try {
    const response = await handleMetadataRequest(body.url, {
      youtube: new YouTubeDataApiClient(youtubeApiKey),
      articles: new ReadabilityExtractor(),
    })

    const responseBody = await response.json()
    return Response.json(responseBody, {
      status: response.status,
      headers: corsHeaders,
    })
  } catch (err) {
    return Response.json(
      { type: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: corsHeaders },
    )
  }
})
