import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateAccessCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RC-${num}`;
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: claims, error: claimsErr } = await callerClient.auth.getUser()
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', claims.user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders })
    }

    const { driverName } = await req.json()
    const accessCode = generateAccessCode()
    const driverNumber = Date.now() % 100000
    const email = `motorista_${driverNumber}@rotacerta.internal`
    const password = `rc${driverNumber}${Math.random().toString(36).substring(2, 6)}`
    const fullName = driverName || `Motorista ${driverNumber}`

    // Create user with email confirmed
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders })
    }

    const userId = newUser.user.id

    // Create profile
    await supabase.from('profiles').insert({
      user_id: userId,
      full_name: fullName,
    })

    // Assign motorista role (delete default role first)
    await supabase.from('user_roles').delete().eq('user_id', userId)
    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'motorista',
    })

    // Store access code
    await supabase.from('driver_access_codes').insert({
      user_id: userId,
      access_code: accessCode,
      driver_password: password,
    })

    return new Response(
      JSON.stringify({ accessCode, password, fullName, userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
