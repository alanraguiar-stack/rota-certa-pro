import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Truck, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { AppSidebar, MobileMenuTrigger } from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  if (role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Acesso não autorizado</h2>
          <p className="text-sm text-muted-foreground">
            Não foi possível verificar suas permissões. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3 md:hidden">
          <MobileMenuTrigger />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold">Rota Certa</span>
          </div>
        </header>
        <main className="flex-1">
          <div className="container max-w-7xl p-4 sm:p-6 md:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
