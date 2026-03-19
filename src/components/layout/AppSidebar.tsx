import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, Route, History, LogOut, Settings, HelpCircle, Navigation } from 'lucide-react';
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
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar">
      {/* Header */}
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Rota Certa</h1>
            <p className="text-xs text-muted-foreground">Roteirização Inteligente</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Menu
        </p>
        <ul className="space-y-0.5">
          {mainMenuItems.map((item) => (
            <li key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === '/'}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors duration-150",
                  "hover:bg-muted hover:text-foreground",
                )}
                activeClassName="bg-primary/10 text-primary font-semibold"
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-sm">{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sistema
        </p>
        <ul className="space-y-0.5">
          {secondaryMenuItems.map((item) => (
            <li key={item.title}>
              <NavLink
                to={item.url}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors duration-150",
                  "hover:bg-muted hover:text-foreground",
                )}
                activeClassName="bg-primary/10 text-primary font-semibold"
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-sm">{item.title}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors duration-150",
                "hover:bg-muted hover:text-foreground",
              )}
            >
              <HelpCircle className="h-[18px] w-[18px] shrink-0" />
              <span className="text-sm">Central de Ajuda</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="mb-2 rounded-lg bg-muted/60 px-3 py-2.5">
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
          className="w-full justify-start gap-3 px-3 h-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sair</span>
        </Button>
      </div>
    </aside>
  );
}
