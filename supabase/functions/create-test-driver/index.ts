import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = new Uint8Array(8)
  crypto.getRandomValues(values)
  const code = Array.from(values).map(v => chars[v % chars.length]).join('')
  return `RC-${code}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: claims, error: claimsErr } = await callerClient.auth.getUser()
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', claims.user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { driverName, driverPassword } = await req.json()
    const accessCode = generateAccessCode()
    const driverNumber = Date.now() % 100000
    const email = `motorista_${driverNumber}@rotacerta.internal`
    const plainPassword = driverPassword && driverPassword.length >= 6 ? driverPassword : `rc${driverNumber}${Math.random().toString(36).substring(2, 6)}`
    const fullName = driverName || `Motorista ${driverNumber}`

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(plainPassword)

    // Create user with email confirmed
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: plainPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = newUser.user.id

    // Create profile
    await supabase.from('profiles').insert({
      user_id: userId,
      full_name: fullName,
    })

    // Assign motorista role
    await supabase.from('user_roles').delete().eq('user_id', userId)
    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'motorista',
    })

    // Store access code with HASHED password
    await supabase.from('driver_access_codes').insert({
      user_id: userId,
      access_code: accessCode,
      password_hash: hashedPassword,
    })

    return new Response(
      JSON.stringify({ accessCode, password: plainPassword, fullName, userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('create-test-driver error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
