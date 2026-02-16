import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, Route, History, LogOut, Settings, HelpCircle, ChevronRight, Navigation } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const adminMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Roteirização', url: '/nova-rota', icon: Route },
  { title: 'Frota', url: '/frota', icon: Truck },
  { title: 'Histórico', url: '/historico', icon: History },
];

const driverMenuItems = [
  { title: 'Minhas Rotas', url: '/motorista', icon: Navigation },
];

const secondaryMenuItems = [
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { isMotorista } = useUserRole();
  const navigate = useNavigate();
  const mainMenuItems = isMotorista ? driverMenuItems : adminMenuItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Header with Logo */}
      <div className="border-b border-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-xl bg-primary blur-lg opacity-40" />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <Truck className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Rota Certa</h1>
            <p className="text-xs text-primary">Roteirização Inteligente</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu Principal
        </p>
        <ul className="space-y-1">
          {mainMenuItems.map((item) => (
            <li key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === '/'}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                activeClassName="bg-accent text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:h-8 before:-translate-y-1/2 before:w-1 before:rounded-r-full before:bg-primary"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-accent/60">
                  <item.icon className="h-5 w-5 shrink-0" />
                </div>
                <span className="text-sm font-medium">{item.title}</span>
                <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition-all group-hover:opacity-60 group-hover:translate-x-0.5" />
              </NavLink>
            </li>
          ))}
        </ul>

        <Separator className="my-5" />

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sistema
        </p>
        <ul className="space-y-1">
          {secondaryMenuItems.map((item) => (
            <li key={item.title}>
              <NavLink
                to={item.url}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
                activeClassName="bg-accent text-primary font-semibold"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-accent/60">
                  <item.icon className="h-5 w-5 shrink-0" />
                </div>
                <span className="text-sm font-medium">{item.title}</span>
              </NavLink>
            </li>
          ))}
          
          {/* Help link */}
          <li>
            <button
              type="button"
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-muted-foreground transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors group-hover:bg-accent/60">
                <HelpCircle className="h-5 w-5 shrink-0" />
              </div>
              <span className="text-sm font-medium">Central de Ajuda</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Footer with User Info */}
      <div className="border-t border-border p-3">
        <div className="mb-3 rounded-xl bg-accent/60 p-3">
          <p className="truncate text-sm font-medium text-foreground">
            {user?.email?.split('@')[0]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 px-3 h-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sair</span>
        </Button>
      </div>
    </aside>
  );
}
