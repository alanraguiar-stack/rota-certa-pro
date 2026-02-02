import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          </div>
          <span className="text-sm font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <SidebarTrigger className="h-9 w-9 rounded-lg border bg-card shadow-sm hover:bg-accent/10 transition-colors">
              <Menu className="h-4 w-4" />
            </SidebarTrigger>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex-1" />
            {/* Future: breadcrumbs, search, notifications can go here */}
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto">
            <div className="container max-w-7xl animate-fade-in p-6 md:p-8">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
