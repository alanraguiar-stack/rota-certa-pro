import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'operacional' | 'motorista';

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isOperacional: boolean;
  isMotorista: boolean;
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch all roles (user may have multiple); pick highest privilege
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
      } else if (data && data.length > 0) {
        const roles = data.map((r: any) => r.role as AppRole);
        const priority: AppRole[] = ['admin', 'operacional', 'motorista'];
        const best = priority.find((p) => roles.includes(p)) ?? null;
        setRole(best);
      } else {
        setRole(null);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isOperacional: role === 'operacional',
    isMotorista: role === 'motorista',
  };
}

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string | null;
  is_active: boolean;
  role: AppRole;
}

export function useUserManagement() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const getAllUsers = useCallback(async (): Promise<UserWithRole[]> => {
    if (!isAdmin) return [];

    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return [];
    }

    // Fetch roles from user_roles table
    const { data: roles, error: rolesError } = await (supabase as any)
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    const rolesMap = new Map<string, AppRole>();
    if (roles) {
      for (const r of roles) {
        rolesMap.set(r.user_id, r.role as AppRole);
      }
    }

    // Build user list with role info
    return profiles.map(profile => ({
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      is_active: (profile as any).is_active ?? true,
      role: rolesMap.get(profile.user_id) || 'operacional',
    }));
  }, [isAdmin]);

  const updateUserRole = useCallback(async (userId: string, newRole: AppRole) => {
    if (!isAdmin) return { error: 'Unauthorized' };

    // Upsert the role
    const { error } = await (supabase as any)
      .from('user_roles')
      .upsert(
        { user_id: userId, role: newRole },
        { onConflict: 'user_id,role' }
      );

    return { error: error?.message };
  }, [isAdmin]);

  const toggleUserActive = useCallback(async (userId: string, isActive: boolean) => {
    if (!isAdmin) return { error: 'Unauthorized' };

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive } as any)
      .eq('user_id', userId);

    return { error: error?.message };
  }, [isAdmin]);

  const deleteUser = useCallback(async (userId: string) => {
    if (!isAdmin) return { error: 'Unauthorized' };

    // Delete from user_roles
    await (supabase as any).from('user_roles').delete().eq('user_id', userId);
    // Delete from driver_access_codes
    await supabase.from('driver_access_codes').delete().eq('user_id', userId);
    // Delete from profiles
    await supabase.from('profiles').delete().eq('user_id', userId);

    return { error: null };
  }, [isAdmin]);

  return {
    getAllUsers,
    updateUserRole,
    toggleUserActive,
    deleteUser,
  };
}
