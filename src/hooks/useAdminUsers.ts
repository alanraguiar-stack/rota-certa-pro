import { useState, useCallback } from 'react';
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

async function callManageUsers(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('manage-users', {
    body: payload,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
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
      const data = await callManageUsers({ action: 'list' });
      return data.users as AdminUser[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    setResettingId(userId);
    try {
      await callManageUsers({ action: 'reset-password', userId, newPassword });
      toast({ title: 'Senha alterada com sucesso!' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao alterar senha', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setResettingId(null);
    }
  }, [toast]);

  const updateEmail = useCallback(async (userId: string, newEmail: string) => {
    setUpdatingEmailId(userId);
    try {
      await callManageUsers({ action: 'update-email', userId, newEmail });
      toast({ title: 'E-mail atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar e-mail', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setUpdatingEmailId(null);
    }
  }, [toast, queryClient]);

  return {
    users: usersQuery.data ?? [],
    isLoading: usersQuery.isLoading,
    resetPassword,
    updateEmail,
    resettingId,
    updatingEmailId,
  };
}
