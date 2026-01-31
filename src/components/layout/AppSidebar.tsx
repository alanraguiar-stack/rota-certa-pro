import { LayoutDashboard, Truck, Route, History, LogOut, Settings, FileText, ChevronRight } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const mainMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, description: 'Visão geral' },
  { title: 'Roteirização', url: '/nova-rota', icon: Route, description: 'Planejar rotas' },
  { title: 'Frota', url: '/frota', icon: Truck, description: 'Gerenciar veículos' },
  { title: 'Histórico', url: '/historico', icon: History, description: 'Rotas anteriores' },
];

const secondaryMenuItems = [
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar 
      collapsible="icon"
      className="border-r-0"
    >
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 shadow-lg shadow-sidebar-primary/20">
            <Truck className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">Rota Certa</h1>
              <p className="text-xs text-sidebar-muted">Roteirização Inteligente</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              Menu Principal
            </p>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-all duration-200",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium before:absolute before:left-0 before:top-1/2 before:h-6 before:-translate-y-1/2 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
                    >
                      <item.icon className="h-5 w-5 shrink-0 transition-colors" />
                      {!isCollapsed && (
                        <>
                          <div className="flex flex-col">
                            <span className="text-sm">{item.title}</span>
                            <span className="text-[10px] text-sidebar-muted group-hover:text-sidebar-accent-foreground/60">
                              {item.description}
                            </span>
                          </div>
                          <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" />
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!isCollapsed && <Separator className="my-4 bg-sidebar-border" />}

        <SidebarGroup>
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
              Sistema
            </p>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-all duration-200",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info */}
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!isCollapsed && (
          <div className="mb-3 rounded-lg bg-sidebar-accent/50 p-3">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user?.email?.split('@')[0]}
            </p>
            <p className="truncate text-[10px] text-sidebar-muted">
              {user?.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'sm'}
          className={cn(
            "w-full text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive",
            !isCollapsed && "justify-start gap-2"
          )}
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
