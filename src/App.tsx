import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Fleet from "./pages/Fleet";
import NewRoute from "./pages/NewRoute";
import RouteDetails from "./pages/RouteDetails";
import History from "./pages/History";
import Settings from "./pages/Settings";
import DriverDashboard from "./pages/DriverDashboard";
import DriverAccess from "./pages/DriverAccess";
import DeliveryConfirmation from "./pages/DeliveryConfirmation";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";

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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
