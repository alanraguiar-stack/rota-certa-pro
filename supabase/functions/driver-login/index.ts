import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { accessCode, password } = await req.json()

    if (!accessCode || !password) {
      return new Response(JSON.stringify({ error: 'Código e senha são obrigatórios' }), { status: 400, headers: corsHeaders })
    }

    // Look up the access code
    const { data: codeData, error: codeErr } = await supabase
      .from('driver_access_codes')
      .select('user_id, driver_password')
      .eq('access_code', accessCode.toUpperCase().trim())
      .single()

    if (codeErr || !codeData) {
      return new Response(JSON.stringify({ error: 'Código de acesso inválido' }), { status: 404, headers: corsHeaders })
    }

    // Verify password using bcrypt compare
    const isValid = await bcrypt.compare(password, codeData.driver_password)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Senha incorreta' }), { status: 401, headers: corsHeaders })
    }

    // Get the user's email to sign in
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(codeData.user_id)
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), { status: 404, headers: corsHeaders })
    }

    // Generate a session — use the plain password provided by user
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const loginClient = createClient(supabaseUrl, anonKey)
    const { data: session, error: loginErr } = await loginClient.auth.signInWithPassword({
      email: userData.user.email!,
      password: password,
    })

    if (loginErr) {
      return new Response(JSON.stringify({ error: 'Erro ao autenticar' }), { status: 401, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ session: session.session, user: session.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
