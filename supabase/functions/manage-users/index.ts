import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Admin client with full privileges
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller identity
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerData.user) return json({ error: 'Unauthorized' }, 401)

    // Verify admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerData.user.id)
      .single()

    if (roleData?.role !== 'admin') return json({ error: 'Admin only' }, 403)

    const { action, userId, newPassword, newEmail } = await req.json()

    // ── list: retorna todos os usuários com email do auth ──────────────────
    if (action === 'list') {
      const { data: authUsers, error: listErr } = await adminClient.auth.admin.listUsers()
      if (listErr) return json({ error: listErr.message }, 500)

      const { data: profiles } = await adminClient.from('profiles').select('*')
      const { data: roles } = await adminClient.from('user_roles').select('user_id, role')
      const { data: accessCodes } = await adminClient
        .from('driver_access_codes')
        .select('user_id, access_code')

      const profilesMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? [])
      const rolesMap = new Map(roles?.map((r: any) => [r.user_id, r.role]) ?? [])
      const codesMap = new Map(accessCodes?.map((c: any) => [c.user_id, c.access_code]) ?? [])

      const users = authUsers.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: (profilesMap.get(u.id) as any)?.full_name ?? null,
        is_active: (profilesMap.get(u.id) as any)?.is_active ?? true,
        role: rolesMap.get(u.id) ?? 'operacional',
        access_code: codesMap.get(u.id) ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))

      return json({ users })
    }

    // ── reset-password: troca senha de um usuário ──────────────────────────
    if (action === 'reset-password') {
      if (!userId || !newPassword) return json({ error: 'userId e newPassword obrigatórios' }, 400)
      if (newPassword.length < 6) return json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400)

      const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) return json({ error: error.message }, 500)

      return json({ success: true })
    }

    // ── update-email: atualiza email de um usuário ─────────────────────────
    if (action === 'update-email') {
      if (!userId || !newEmail) return json({ error: 'userId e newEmail obrigatórios' }, 400)
      if (!newEmail.includes('@')) return json({ error: 'Email inválido' }, 400)

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        email: newEmail,
        email_confirm: true, // confirma direto, sem precisar de link
      })
      if (error) return json({ error: error.message }, 500)

      return json({ success: true })
    }

    return json({ error: 'Ação inválida' }, 400)

  } catch (err: any) {
    return json({ error: err.message ?? 'Erro interno' }, 500)
  }
})
