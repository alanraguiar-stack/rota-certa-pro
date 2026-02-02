import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Truck, Route, History, LogOut, Settings, FileText, HelpCircle, ChevronRight, Menu } from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const mainMenuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Roteirização', url: '/nova-rota', icon: Route },
  { title: 'Frota', url: '/frota', icon: Truck },
  { title: 'Histórico', url: '/historico', icon: History },
];

const secondaryMenuItems = [
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [isHovering, setIsHovering] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // Expand on hover when collapsed
  const handleMouseEnter = () => {
    if (isCollapsed) {
      setIsHovering(true);
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (isHovering) {
      setIsHovering(false);
      setOpen(false);
    }
  };

  const showExpanded = !isCollapsed || isHovering;

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar 
        collapsible="icon"
        className="border-r-0 transition-all duration-300"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header with Logo */}
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-5">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-sidebar-primary blur-lg opacity-40" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 shadow-lg">
                <Truck className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
            </div>
            {showExpanded && (
              <div className="animate-fade-in overflow-hidden">
                <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground whitespace-nowrap">Rota Certa</h1>
                <p className="text-xs text-sidebar-primary whitespace-nowrap">Roteirização Inteligente</p>
              </div>
            )}
          </div>
        </SidebarHeader>

        {/* Main Navigation */}
        <SidebarContent className="px-2 py-5">
          <SidebarGroup>
            {showExpanded && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted animate-fade-in">
                Menu Principal
              </p>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {mainMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === '/'}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sidebar-foreground/70 transition-all duration-200",
                              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold before:absolute before:left-0 before:top-1/2 before:h-8 before:-translate-y-1/2 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 transition-colors group-hover:bg-sidebar-accent">
                              <item.icon className="h-5 w-5 shrink-0" />
                            </div>
                            {showExpanded && (
                              <>
                                <span className="text-sm font-medium whitespace-nowrap animate-fade-in">{item.title}</span>
                                <ChevronRight className="ml-auto h-4 w-4 opacity-0 transition-all group-hover:opacity-60 group-hover:translate-x-0.5" />
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {!showExpanded && (
                        <TooltipContent side="right" className="font-medium">
                          {item.title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {showExpanded && <Separator className="my-5 bg-sidebar-border" />}

          <SidebarGroup>
            {showExpanded && (
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted animate-fade-in">
                Sistema
              </p>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {secondaryMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={cn(
                              "group flex items-center gap-3 rounded-xl px-3 py-3 text-sidebar-foreground/70 transition-all duration-200",
                              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 transition-colors group-hover:bg-sidebar-accent">
                              <item.icon className="h-5 w-5 shrink-0" />
                            </div>
                            {showExpanded && (
                              <span className="text-sm font-medium whitespace-nowrap animate-fade-in">{item.title}</span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {!showExpanded && (
                        <TooltipContent side="right" className="font-medium">
                          {item.title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
                
                {/* Help link */}
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <button
                          type="button"
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sidebar-foreground/70 transition-all duration-200",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent/50 transition-colors group-hover:bg-sidebar-accent">
                            <HelpCircle className="h-5 w-5 shrink-0" />
                          </div>
                          {showExpanded && (
                            <span className="text-sm font-medium whitespace-nowrap animate-fade-in">Central de Ajuda</span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {!showExpanded && (
                      <TooltipContent side="right" className="font-medium">
                        Central de Ajuda
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer with User Info */}
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {showExpanded && (
            <div className="mb-3 rounded-xl bg-sidebar-accent/60 p-3 animate-fade-in">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.email?.split('@')[0]}
              </p>
              <p className="truncate text-xs text-sidebar-muted">
                {user?.email}
              </p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={showExpanded ? 'sm' : 'icon'}
                className={cn(
                  "w-full text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors",
                  showExpanded ? "justify-start gap-3 px-3 h-11" : "h-11 w-11"
                )}
              onClick={handleSignOut}
            >
                <LogOut className="h-5 w-5" />
                {showExpanded && <span className="font-medium animate-fade-in">Sair</span>}
              </Button>
            </TooltipTrigger>
            {!showExpanded && (
              <TooltipContent side="right" className="font-medium">
                Sair
              </TooltipContent>
            )}
          </Tooltip>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
