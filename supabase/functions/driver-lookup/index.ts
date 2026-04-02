import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MINUTES = 5

function maskName(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return `${parts[0]?.[0] || ''}.`
  const firstInitial = parts[0][0]
  const lastName = parts[parts.length - 1]
  return `${firstInitial}. ${lastName}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { accessCode } = await req.json()

    if (!accessCode || typeof accessCode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Código de acesso é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('attempt_type', 'lookup')
      .gte('created_at', windowStart)

    if ((count || 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record attempt
    await supabase.from('login_attempts').insert({ ip_address: ip, attempt_type: 'lookup' })

    const { data: codeData } = await supabase
      .from('driver_access_codes')
      .select('user_id')
      .eq('access_code', accessCode.toUpperCase().trim())
      .single()

    if (!codeData) {
      return new Response(
        JSON.stringify({ fullName: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', codeData.user_id)
      .single()

    // Return masked name (e.g., "J. Silva" instead of "João Silva")
    const maskedName = profile?.full_name ? maskName(profile.full_name) : null

    return new Response(
      JSON.stringify({ fullName: maskedName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('driver-lookup error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
