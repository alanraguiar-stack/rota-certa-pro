import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar, MobileMenuTrigger } from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
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

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        {/* Mobile header */}
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
