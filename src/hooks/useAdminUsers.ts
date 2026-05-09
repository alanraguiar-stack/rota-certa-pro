import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AdminUser {
  id: string;          // = user_id (auth.users)
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  role: 'admin' | 'operacional' | 'motorista';
  access_code: string | null;
  created_at: string;
}

export function useAdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingEmailId, setUpdatingEmailId] = useState<string | null>(null);

  // ── Listar usuários — sem Edge Function, direto do banco ────────────────
  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // 1. Profiles (nome, is_active, created_at)
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, is_active, created_at');
      if (pErr) throw new Error(pErr.message);

      // 2. Roles
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role');

      // 3. Access codes (motoristas)
      const { data: codes } = await supabase
        .from('driver_access_codes')
        .select('user_id, access_code');

      // 4. Email do usuário logado (para mostrar pelo menos o próprio)
      const { data: { user: me } } = await supabase.auth.getUser();

      const rolesMap = new Map<string, string>(
        (roles ?? []).map((r: any) => [r.user_id, r.role])
      );
      const codesMap = new Map<string, string>(
        (codes ?? []).map((c: any) => [c.user_id, c.access_code])
      );

      return (profiles ?? []).map((p: any) => ({
        id: p.user_id,
        // email visível apenas para o próprio usuário (sem Edge Function)
        // para ver todos os emails, a Edge Function manage-users precisa estar deployada
        email: p.user_id === me?.id ? (me.email ?? null) : null,
        full_name: p.full_name ?? null,
        is_active: p.is_active ?? true,
        role: (rolesMap.get(p.user_id) ?? 'operacional') as AdminUser['role'],
        access_code: codesMap.get(p.user_id) ?? null,
        created_at: p.created_at,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // ── Tentar buscar TODOS os emails via Edge Function (opcional) ───────────
  // Se a função estiver deployada, enriquece os dados com emails reais
  const enrichWithEmails = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.error || res.data?.error) return; // Edge Function não disponível — ok
      
      const emailMap = new Map<string, string>(
        (res.data.users ?? []).map((u: any) => [u.id, u.email])
      );
      
      // Atualiza cache com emails reais
      queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) =>
        (old ?? []).map(u => ({
          ...u,
          email: emailMap.get(u.id) ?? u.email,
        }))
      );
    } catch {
      // Edge Function não deployada — silencioso, funciona sem ela
    }
  }, [queryClient]);

  // Enriquece com emails quando os usuários carregam
  const isLoaded = usersQuery.isSuccess && usersQuery.data && usersQuery.data.length > 0;
  useState(() => {
    if (isLoaded) enrichWithEmails();
  });

  // ── Redefinir senha via Edge Function ────────────────────────────────────
  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    setResettingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se for o próprio usuário, usa a API normal
      const { data: { user: me } } = await supabase.auth.getUser();
      if (userId === me?.id) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      } else {
        // Para outros usuários, precisa da Edge Function
        const res = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset-password', userId, newPassword },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      }
      
      toast({ title: 'Senha alterada com sucesso!' });
      return true;
    } catch (err: any) {
      const isNotDeployed = err.message?.includes('Failed to fetch') || err.message?.includes('404');
      toast({
        title: 'Erro ao alterar senha',
        description: isNotDeployed
          ? 'A Edge Function manage-users precisa estar deployada no Supabase para alterar senha de outros usuários.'
          : err.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setResettingId(null);
    }
  }, [toast]);

  // ── Atualizar email via Edge Function ────────────────────────────────────
  const updateEmail = useCallback(async (userId: string, newEmail: string) => {
    setUpdatingEmailId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user: me } } = await supabase.auth.getUser();

      if (userId === me?.id) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
      } else {
        const res = await supabase.functions.invoke('manage-users', {
          body: { action: 'update-email', userId, newEmail },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      }

      toast({ title: 'E-mail atualizado!' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      return true;
    } catch (err: any) {
      const isNotDeployed = err.message?.includes('Failed to fetch') || err.message?.includes('404');
      toast({
        title: 'Erro ao atualizar e-mail',
        description: isNotDeployed
          ? 'A Edge Function manage-users precisa estar deployada para editar e-mail de outros usuários.'
          : err.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setUpdatingEmailId(null);
    }
  }, [toast, queryClient]);

  return {
    users: usersQuery.data ?? [],
    isLoading: usersQuery.isLoading,
    isError: usersQuery.isError,
    error: usersQuery.error as Error | null,
    resetPassword,
    updateEmail,
    resettingId,
    updatingEmailId,
  };
}
