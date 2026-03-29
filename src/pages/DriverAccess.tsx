import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Truck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function DriverAccess() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [driverName, setDriverName] = useState('');

  // If already logged in as driver, redirect
  useEffect(() => {
    if (user) {
      navigate('/motorista', { replace: true });
    }
  }, [user, navigate]);

  // Look up driver name from code via secure edge function
  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data } = await supabase.functions.invoke('driver-lookup', {
        body: { accessCode: code },
      });
      if (data?.fullName) setDriverName(data.fullName);
    })();
  }, [code]);

  const handleLogin = async () => {
    if (!password || !code) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('driver-login', {
        body: { accessCode: code, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set the session manually
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast({ title: 'Bem-vindo!' });
        navigate('/motorista', { replace: true });
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao acessar',
        description: err.message || 'Verifique o código e senha',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">Rota Certa</CardTitle>
          {driverName && (
            <p className="text-muted-foreground text-sm mt-1">Olá, {driverName}!</p>
          )}
          {code && (
            <p className="text-xs text-muted-foreground mt-1">
              Código: <span className="font-mono font-bold">{code.toUpperCase()}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full gap-2"
            size="lg"
          >
            <LogIn className="h-5 w-5" />
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
