import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MINUTES = 5

async function checkRateLimit(supabase: any, ip: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('attempt_type', 'login')
    .gte('created_at', windowStart)
  return (count || 0) >= RATE_LIMIT_MAX
}

async function recordAttempt(supabase: any, ip: string) {
  await supabase.from('login_attempts').insert({ ip_address: ip, attempt_type: 'login' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const isRateLimited = await checkRateLimit(supabase, ip)
    if (isRateLimited) {
      return new Response(
        JSON.stringify({ error: 'Muitas tentativas. Aguarde alguns minutos.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { accessCode, password } = await req.json()

    if (!accessCode || !password) {
      return new Response(JSON.stringify({ error: 'Código e senha são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Record attempt
    await recordAttempt(supabase, ip)

    // Look up the access code
    const { data: codeData, error: codeErr } = await supabase
      .from('driver_access_codes')
      .select('user_id, driver_password')
      .eq('access_code', accessCode.toUpperCase().trim())
      .single()

    if (codeErr || !codeData) {
      return new Response(JSON.stringify({ error: 'Código de acesso inválido' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify password using bcrypt compare
    const isValid = await bcrypt.compare(password, codeData.driver_password)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Senha incorreta' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get the user's email to sign in
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(codeData.user_id)
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate a session
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const loginClient = createClient(supabaseUrl, anonKey)
    const { data: session, error: loginErr } = await loginClient.auth.signInWithPassword({
      email: userData.user.email!,
      password: password,
    })

    if (loginErr) {
      return new Response(JSON.stringify({ error: 'Erro ao autenticar' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ session: session.session, user: session.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('driver-login error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
