import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, MapPin, Route, Package, Navigation, ArrowRight, Loader2, HelpCircle, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Animated truck component for the background
function AnimatedTruck({ delay, className }: { delay: number; className?: string }) {
  return (
    <div 
      className={`absolute opacity-20 ${className}`}
      style={{ 
        animation: `truck-move 12s ease-in-out infinite`,
        animationDelay: `${delay}s`
      }}
    >
      <Truck className="h-8 w-8 text-accent" />
    </div>
  );
}

// Route line SVG animation
function AnimatedRoutes() {
  return (
    <svg 
      className="absolute inset-0 h-full w-full" 
      viewBox="0 0 1200 800" 
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="routeGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(168, 76%, 42%)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(192, 91%, 48%)" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="routeGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(24, 95%, 58%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="hsl(168, 76%, 42%)" stopOpacity="0.2" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Main route paths */}
      <path
        d="M-50,450 Q200,300 400,380 T700,320 T1000,400 T1250,350"
        fill="none"
        stroke="url(#routeGradient1)"
        strokeWidth="3"
        strokeDasharray="15 10"
        className="animate-route-trace"
        filter="url(#glow)"
      />
      <path
        d="M-50,550 Q150,450 350,500 T650,420 T950,500 T1250,450"
        fill="none"
        stroke="url(#routeGradient1)"
        strokeWidth="2"
        strokeDasharray="12 8"
        className="animate-route-trace"
        style={{ animationDelay: '1.5s' }}
      />
      <path
        d="M-50,300 Q250,200 450,280 T750,220 T1050,300 T1250,250"
        fill="none"
        stroke="url(#routeGradient2)"
        strokeWidth="2"
        strokeDasharray="10 6"
        className="animate-route-trace"
        style={{ animationDelay: '3s' }}
      />
      
      {/* Delivery points */}
      {[
        { cx: 200, cy: 350, delay: 0 },
        { cx: 450, cy: 400, delay: 0.5 },
        { cx: 680, cy: 340, delay: 1 },
        { cx: 900, cy: 420, delay: 1.5 },
        { cx: 350, cy: 500, delay: 2 },
        { cx: 600, cy: 450, delay: 2.5 },
        { cx: 800, cy: 380, delay: 3 },
      ].map((point, i) => (
        <g key={i}>
          <circle
            cx={point.cx}
            cy={point.cy}
            r="8"
            fill="hsl(168, 76%, 42%)"
            opacity="0.3"
            className="animate-dot-pulse"
            style={{ animationDelay: `${point.delay}s` }}
          />
          <circle
            cx={point.cx}
            cy={point.cy}
            r="4"
            fill="hsl(168, 76%, 50%)"
            className="animate-dot-pulse"
            style={{ animationDelay: `${point.delay}s` }}
          />
        </g>
      ))}
    </svg>
  );
}

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero-gradient">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Erro ao entrar',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        if (!fullName.trim()) {
          toast({
            title: 'Nome obrigatório',
            description: 'Por favor, informe seu nome completo.',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            title: 'Erro ao criar conta',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Conta criada!',
            description: 'Verifique seu email para confirmar a conta.',
          });
          setIsLogin(true);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Background - Dark gradient inspired by Mega Vale Card */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated routes visualization */}
        <AnimatedRoutes />
        
        {/* Floating trucks */}
        <AnimatedTruck delay={0} className="left-[5%] top-[25%]" />
        <AnimatedTruck delay={4} className="left-[15%] top-[60%]" />
        <AnimatedTruck delay={8} className="left-[25%] top-[40%]" />

        {/* Floating icons with parallax effect */}
        <div className="absolute left-[8%] top-[15%] animate-float opacity-15">
          <div className="rounded-2xl bg-accent/20 p-4 backdrop-blur-sm">
            <Package className="h-10 w-10 text-accent" />
          </div>
        </div>
        <div className="absolute right-[12%] top-[20%] animate-float-reverse opacity-12" style={{ animationDelay: '1s' }}>
          <div className="rounded-2xl bg-cta/20 p-3 backdrop-blur-sm">
            <Navigation className="h-8 w-8 text-cta" />
          </div>
        </div>
        <div className="absolute bottom-[20%] left-[15%] animate-float opacity-12" style={{ animationDelay: '2s' }}>
          <div className="rounded-2xl bg-info/20 p-3 backdrop-blur-sm">
            <Route className="h-8 w-8 text-info" />
          </div>
        </div>
        <div className="absolute bottom-[30%] right-[20%] animate-float-reverse opacity-15" style={{ animationDelay: '0.5s' }}>
          <div className="rounded-2xl bg-accent/20 p-4 backdrop-blur-sm">
            <MapPin className="h-9 w-9 text-accent" />
          </div>
        </div>

        {/* Gradient orbs */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-cta/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-info/6 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 lg:justify-end lg:pr-[8%]">
        {/* Left side - Branding (hidden on mobile) */}
        <div 
          className={`absolute left-[6%] top-1/2 hidden -translate-y-1/2 lg:block transition-all duration-700 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
        >
          <div className="max-w-lg space-y-8">
            {/* Logo and title */}
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-accent blur-xl opacity-40" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 shadow-glow-accent">
                  <Truck className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-white">Rota Certa</h1>
                <p className="mt-1 text-xl text-accent">Roteirização Inteligente</p>
              </div>
            </div>
            
            {/* Tagline */}
            <p className="text-2xl leading-relaxed text-white/70">
              Planeje rotas otimizadas, gerencie sua frota e <span className="text-accent">maximize a eficiência</span> das suas entregas.
            </p>

            {/* Features list */}
            <div className="space-y-4 pt-4">
              {[
                { icon: Route, text: 'Otimização automática de rotas', color: 'accent' },
                { icon: Package, text: 'Romaneios de carga inteligentes', color: 'cta' },
                { icon: MapPin, text: 'Geocodificação precisa', color: 'info' },
              ].map((item, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-4 text-white/70 transition-all duration-500 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                  style={{ transitionDelay: `${300 + index * 100}ms` }}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${item.color}/15 border border-${item.color}/30`}>
                    <item.icon className={`h-6 w-6 text-${item.color}`} />
                  </div>
                  <span className="text-lg">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card 
          className={`w-full max-w-[440px] border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-2xl transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <CardHeader className="space-y-2 pb-6 text-center">
            {/* Mobile logo */}
            <div className="mx-auto mb-6 flex items-center gap-4 lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 shadow-glow-accent">
                <Truck className="h-7 w-7 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-white">Rota Certa</h1>
                <p className="text-sm text-accent">Roteirização Inteligente</p>
              </div>
            </div>

            <CardTitle className="text-3xl font-bold text-white">
              {isLogin ? 'Bem-vindo!' : 'Criar conta'}
            </CardTitle>
            <CardDescription className="text-base text-white/50">
              {isLogin
                ? 'Acesse sua conta para continuar'
                : 'Preencha os dados para começar'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium text-white/80">Nome completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-white/80">Senha</Label>
                  {isLogin && (
                    <button type="button" className="text-xs text-accent hover:text-accent/80 transition-colors">
                      Esqueci a senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-5 pt-2">
              <Button 
                type="submit" 
                className="group h-12 w-full bg-gradient-to-r from-cta to-warning font-semibold text-white shadow-lg shadow-cta/25 transition-all hover:shadow-xl hover:shadow-cta/35 hover:-translate-y-0.5" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Aguarde...
                  </>
                ) : (
                  <>
                    {isLogin ? 'Acessar' : 'Criar conta'}
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
              
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-3 text-white/40">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full text-white/60 hover:bg-white/5 hover:text-white"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? 'Não tem conta? Cadastre-se'
                  : 'Já tem conta? Entre'}
              </Button>

              {/* Help link */}
              <button 
                type="button"
                className="flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                Central de Ajuda
              </button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-sm text-white/30">
          © 2026 Rota Certa • Roteirização Inteligente
        </p>
      </div>
    </div>
  );
}
