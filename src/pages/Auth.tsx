import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, MapPin, Route, Package, Navigation, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
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
            description: 'Você já pode fazer login.',
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
      {/* Background - Dark gradient with pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(210,40%,12%)] via-[hsl(215,35%,15%)] to-[hsl(200,40%,18%)]" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Route lines - animated SVG paths */}
        <svg className="absolute inset-0 h-full w-full opacity-10" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(160, 84%, 45%)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="hsl(200, 80%, 45%)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {/* Main route path */}
          <path
            d="M0,400 Q300,200 500,350 T800,300 T1200,400"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="3"
            strokeDasharray="12 8"
            className="animate-pulse-slow"
          />
          <path
            d="M0,500 Q200,400 400,450 T700,380 T1200,500"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="2"
            strokeDasharray="8 6"
            className="animate-pulse-slow"
            style={{ animationDelay: '1s' }}
          />
          <path
            d="M0,300 Q250,150 450,250 T750,200 T1200,350"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="2"
            strokeDasharray="6 4"
            className="animate-pulse-slow"
            style={{ animationDelay: '2s' }}
          />
        </svg>

        {/* Floating icons */}
        <div className="absolute left-[10%] top-[20%] animate-float opacity-20">
          <Truck className="h-16 w-16 text-white" />
        </div>
        <div className="absolute right-[15%] top-[30%] animate-float opacity-15" style={{ animationDelay: '2s' }}>
          <Package className="h-12 w-12 text-white" />
        </div>
        <div className="absolute bottom-[25%] left-[20%] animate-float opacity-15" style={{ animationDelay: '3s' }}>
          <Navigation className="h-10 w-10 text-white" />
        </div>
        <div className="absolute bottom-[35%] right-[25%] animate-float opacity-20" style={{ animationDelay: '1s' }}>
          <Route className="h-14 w-14 text-white" />
        </div>

        {/* Location pins */}
        <div className="absolute left-[30%] top-[40%] animate-pulse-slow">
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/30">
            <div className="h-2 w-2 rounded-full bg-accent" />
          </div>
        </div>
        <div className="absolute right-[35%] top-[25%] animate-pulse-slow" style={{ animationDelay: '1.5s' }}>
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-primary/30">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
        </div>
        <div className="absolute bottom-[40%] left-[45%] animate-pulse-slow" style={{ animationDelay: '0.5s' }}>
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/30">
            <div className="h-2.5 w-2.5 rounded-full bg-accent" />
          </div>
        </div>

        {/* Gradient orbs */}
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 lg:justify-end lg:pr-[10%]">
        {/* Left side - Branding (hidden on mobile) */}
        <div className="absolute left-[8%] top-1/2 hidden -translate-y-1/2 lg:block">
          <div className="max-w-md space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent/80 shadow-glow-accent">
                <Truck className="h-9 w-9 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Rota Certa</h1>
                <p className="text-lg text-white/60">Roteirização Inteligente</p>
              </div>
            </div>
            
            <p className="text-xl leading-relaxed text-white/70">
              Planeje rotas otimizadas, gerencie sua frota e acompanhe entregas em tempo real.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-3 text-white/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Route className="h-4 w-4 text-accent" />
                </div>
                <span>Otimização automática de rotas</span>
              </div>
              <div className="flex items-center gap-3 text-white/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Package className="h-4 w-4 text-accent" />
                </div>
                <span>Gestão completa de cargas</span>
              </div>
              <div className="flex items-center gap-3 text-white/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <MapPin className="h-4 w-4 text-accent" />
                </div>
                <span>Rastreamento em tempo real</span>
              </div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="w-full max-w-[420px] border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4 text-center">
            {/* Mobile logo */}
            <div className="mx-auto mb-4 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-white">Rota Certa</h1>
                <p className="text-xs text-white/60">Roteirização Inteligente</p>
              </div>
            </div>

            <CardTitle className="text-2xl font-semibold text-white">
              {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
            </CardTitle>
            <CardDescription className="text-white/50">
              {isLogin
                ? 'Entre com suas credenciais para acessar o sistema'
                : 'Preencha os dados para criar sua conta'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-white/80">Nome completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-accent focus:ring-accent"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="group w-full bg-gradient-to-r from-accent to-accent/90 font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aguarde...
                  </>
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar conta'}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
              
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-white/40">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-white/60 hover:bg-white/5 hover:text-white"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin
                  ? 'Não tem conta? Cadastre-se'
                  : 'Já tem conta? Entre'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-white/30">
          © 2026 Rota Certa • Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
