import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Estáticos — carregam imediatamente (fast first paint)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

// Lazy — carregam quando o usuário navega pela primeira vez
const Fleet                = lazy(() => import("./pages/Fleet"));
const NewRoute             = lazy(() => import("./pages/NewRoute"));
const RouteDetails         = lazy(() => import("./pages/RouteDetails"));
const History              = lazy(() => import("./pages/History"));
const Settings             = lazy(() => import("./pages/Settings"));
const DriverDashboard      = lazy(() => import("./pages/DriverDashboard"));
const DriverAccess         = lazy(() => import("./pages/DriverAccess"));
const DeliveryConfirmation = lazy(() => import("./pages/DeliveryConfirmation"));

// Prefetch das páginas mais usadas no idle do browser
// Elimina o delay de carregamento na primeira navegação para cada tela
function PrefetchPages() {
  useEffect(() => {
    const prefetch = () => {
      // Prefetch em sequência, sem bloquear a thread principal
      import("./pages/NewRoute");
      import("./pages/RouteDetails");
      import("./pages/History");
      import("./pages/Fleet");
      import("./pages/Settings");
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetch, { timeout: 3000 });
    } else {
      setTimeout(prefetch, 2000);
    }
  }, []);
  return null;
}

// Spinner minimalista — só uma barra no topo, não bloqueia a tela
const PageSpinner = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, right: 0, height: "2px",
    background: "linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)",
    backgroundSize: "200% 100%",
    animation: "slide 1.2s linear infinite",
    zIndex: 9999,
  }}>
    <style>{`@keyframes slide { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PrefetchPages />
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/frota" element={<Fleet />} />
              <Route path="/nova-rota" element={<NewRoute />} />
              <Route path="/rota/:id" element={<RouteDetails />} />
              <Route path="/historico" element={<History />} />
              <Route path="/configuracoes" element={<Settings />} />
              <Route path="/motorista" element={<DriverDashboard />} />
              <Route path="/motorista/acesso/:code" element={<DriverAccess />} />
              <Route path="/motorista/entrega/:id" element={<DeliveryConfirmation />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
