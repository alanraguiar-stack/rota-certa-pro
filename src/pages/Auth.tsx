import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck, MapPin } from 'lucide-react';
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
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <div className="relative">
              <Truck className="h-8 w-8 text-primary" />
              <MapPin className="absolute -bottom-1 -right-1 h-4 w-4 text-accent" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Rota Certa</CardTitle>
          <CardDescription>
            {isLogin
              ? 'Entre para acessar o sistema de roteirização'
              : 'Crie sua conta para começar'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? 'Aguarde...'
                : isLogin
                ? 'Entrar'
                : 'Criar conta'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
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
  );
}
