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

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: claims } = await callerClient.auth.getUser()
    if (!claims?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', claims.user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders })
    }

    // Fetch all access codes
    const { data: codes, error } = await supabase
      .from('driver_access_codes')
      .select('id, driver_password')

    if (error || !codes) {
      return new Response(JSON.stringify({ error: 'Failed to fetch codes' }), { status: 500, headers: corsHeaders })
    }

    let migrated = 0
    let skipped = 0

    for (const code of codes) {
      // bcrypt hashes start with $2a$ or $2b$ — skip already hashed
      if (code.driver_password.startsWith('$2a$') || code.driver_password.startsWith('$2b$')) {
        skipped++
        continue
      }

      const hashed = await bcrypt.hash(code.driver_password)
      await supabase
        .from('driver_access_codes')
        .update({ driver_password: hashed })
        .eq('id', code.id)

      migrated++
    }

    return new Response(
      JSON.stringify({ migrated, skipped, total: codes.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
