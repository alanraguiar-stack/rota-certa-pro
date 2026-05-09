import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  role: 'admin' | 'operacional' | 'motorista';
  access_code: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export function useAdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingEmailId, setUpdatingEmailId] = useState<string | null>(null);

  const usersQuery = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const [profilesRes, rolesRes, codesRes, meRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, is_active, created_at'),
        (supabase as any).from('user_roles').select('user_id, role'),
        supabase.from('driver_access_codes').select('user_id, access_code'),
        supabase.auth.getUser(),
      ]);

      if (profilesRes.error) throw new Error(profilesRes.error.message);

      const me = meRes.data?.user;
      const rolesMap = new Map<string, string>(
        (rolesRes.data ?? []).map((r: any) => [r.user_id, r.role])
      );
      const codesMap = new Map<string, string>(
        (codesRes.data ?? []).map((c: any) => [c.user_id, c.access_code])
      );

      return (profilesRes.data ?? []).map((p: any) => ({
        id: p.user_id,
        email: p.user_id === me?.id ? (me?.email ?? null) : null,
        full_name: p.full_name ?? null,
        is_active: p.is_active ?? true,
        role: (rolesMap.get(p.user_id) ?? 'operacional') as AdminUser['role'],
        access_code: codesMap.get(p.user_id) ?? null,
        created_at: p.created_at,
        last_sign_in_at: null,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // Enriquecer com emails via Edge Function quando disponível
  useEffect(() => {
    if (!usersQuery.isSuccess || !usersQuery.data?.length) return;
    const enrich = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await supabase.functions.invoke('manage-users', {
          body: { action: 'list' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.error || res.data?.error || !res.data?.users) return;
        const map = new Map<string, { email: string; last_sign_in_at: string | null }>(
          res.data.users.map((u: any) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at ?? null }])
        );
        queryClient.setQueryData<AdminUser[]>(['admin-users'], (old) =>
          (old ?? []).map(u => ({
            ...u,
            email: map.get(u.id)?.email ?? u.email,
            last_sign_in_at: map.get(u.id)?.last_sign_in_at ?? null,
          }))
        );
      } catch { /* Edge Function não deployada — silencioso */ }
    };
    enrich();
  }, [usersQuery.isSuccess, usersQuery.data?.length, queryClient]);

  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return false;
    }
    setResettingId(userId);
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (userId === me?.id) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke('manage-users', {
          body: { action: 'reset-password', userId, newPassword },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      }
      toast({ title: 'Senha alterada com sucesso!' });
      return true;
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: err.message?.includes('Failed to fetch') || err.message?.includes('404')
          ? 'Deploy a Edge Function manage-users no Supabase para alterar senha de outros usuários.'
          : err.message,
        variant: 'destructive',
      });
      return false;
    } finally { setResettingId(null); }
  }, [toast]);

  const updateEmail = useCallback(async (userId: string, newEmail: string) => {
    if (!newEmail.includes('@')) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return false;
    }
    setUpdatingEmailId(userId);
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (userId === me?.id) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await supabase.functions.invoke('manage-users', {
          body: { action: 'update-email', userId, newEmail },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      }
      toast({ title: 'E-mail atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      return true;
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar e-mail',
        description: err.message?.includes('Failed to fetch') || err.message?.includes('404')
          ? 'Deploy a Edge Function manage-users no Supabase para editar e-mail de outros usuários.'
          : err.message,
        variant: 'destructive',
      });
      return false;
    } finally { setUpdatingEmailId(null); }
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
