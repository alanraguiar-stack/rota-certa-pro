import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Estáticos — carregam imediatamente (first paint rápido)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";

// Lazy — carregam apenas quando o usuário navega para a rota pela primeira vez
const Fleet                = lazy(() => import("./pages/Fleet"));
const NewRoute             = lazy(() => import("./pages/NewRoute"));
const RouteDetails         = lazy(() => import("./pages/RouteDetails"));
const History              = lazy(() => import("./pages/History"));
const Settings             = lazy(() => import("./pages/Settings"));
const DriverDashboard      = lazy(() => import("./pages/DriverDashboard"));
const DriverAccess         = lazy(() => import("./pages/DriverAccess"));
const DeliveryConfirmation = lazy(() => import("./pages/DeliveryConfirmation"));

// Spinner mínimo exibido enquanto o chunk da página carrega
const PageSpinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
    <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // dados frescos por 30s — sem re-fetch desnecessário
      gcTime: 5 * 60_000,          // cache vive 5min após componente desmontar
      retry: 1,                    // 1 retry em erro (padrão era 3)
      refetchOnWindowFocus: false, // não refaz ao trocar de aba/janela
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
