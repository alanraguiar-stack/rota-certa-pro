import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, TruckFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useTrucks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const trucksQuery = useQuery({
    queryKey: ['trucks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Truck[];
    },
    enabled: !!user,
  });

  const activeTrucks = trucksQuery.data?.filter((t) => t.is_active) ?? [];
  const totalCapacity = activeTrucks.reduce((sum, t) => sum + Number(t.capacity_kg), 0);

  const createTruck = useMutation({
    mutationFn: async (data: TruckFormData) => {
      const { data: truck, error } = await supabase
        .from('trucks')
        .insert({
          user_id: user!.id,
          plate: data.plate.toUpperCase(),
          model: data.model,
          capacity_kg: data.capacity_kg,
          max_deliveries: data.max_deliveries || null,
        })
        .select()
        .single();

      if (error) throw error;
      return truck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast({ title: 'Caminhão cadastrado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao cadastrar caminhão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTruck = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TruckFormData & { is_active: boolean }> }) => {
      const { data: truck, error } = await supabase
        .from('trucks')
        .update({
          ...data,
          plate: data.plate?.toUpperCase(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return truck;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast({ title: 'Caminhão atualizado!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar caminhão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTruck = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trucks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trucks'] });
      toast({ title: 'Caminhão removido!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover caminhão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    trucks: trucksQuery.data ?? [],
    activeTrucks,
    totalCapacity,
    isLoading: trucksQuery.isLoading,
    error: trucksQuery.error,
    createTruck,
    updateTruck,
    deleteTruck,
  };
}
