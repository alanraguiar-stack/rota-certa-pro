import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useUserRole, useUserManagement, AppRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings as SettingsIcon, User, Shield, Moon, Sun, Users, Lock, Package, History, UserPlus, Copy } from 'lucide-react';
import { ProductUnitsImporter } from '@/components/route/ProductUnitsImporter';
import { RouteHistoryImporter } from '@/components/route/RouteHistoryImporter';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  is_active: boolean;
  role: AppRole;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isAdmin, isMotorista, loading: roleLoading } = useUserRole();
  const { getAllUsers, updateUserRole, toggleUserActive } = useUserManagement();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [driverInfo, setDriverInfo] = useState<{ accessCode: string; password: string; fullName: string; accessLink: string } | null>(null);
  const [accessCodes, setAccessCodes] = useState<Record<string, { accessCode: string; password: string }>>({});

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      if (data?.full_name) {
        setFullName(data.full_name);
      }
    };

    loadProfile();
  }, [user]);

  // Load all users and access codes (admin only)
  useEffect(() => {
    const loadUsers = async () => {
      if (!isAdmin) return;

      setLoadingUsers(true);
      const allUsers = await getAllUsers();
      setUsers(allUsers);

      // Fetch access codes for all drivers
      const { data: codes } = await supabase
        .from('driver_access_codes')
        .select('user_id, access_code, driver_password');
      
      if (codes) {
        const codesMap: Record<string, { accessCode: string; password: string }> = {};
        for (const c of codes) {
          codesMap[c.user_id] = { accessCode: c.access_code, password: c.driver_password };
        }
        setAccessCodes(codesMap);
      }

      setLoadingUsers(false);
    };

    if (!roleLoading && isAdmin) {
      loadUsers();
    }
  }, [isAdmin, roleLoading, getAllUsers]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Perfil atualizado com sucesso!' });
    } catch (err) {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({ title: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao alterar senha', variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    const { error } = await updateUserRole(userId, newRole);

    if (error) {
      toast({ title: error, variant: 'destructive' });
    } else {
      toast({ title: 'Permissão atualizada!' });
      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    const { error } = await toggleUserActive(userId, !currentlyActive);

    if (error) {
      toast({ title: error, variant: 'destructive' });
    } else {
      toast({ title: currentlyActive ? 'Usuário desativado' : 'Usuário ativado' });
      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, is_active: !currentlyActive } : u
      ));
    }
  };

  const handleCreateDriver = async () => {
    if (!newDriverName.trim()) {
      toast({ title: 'Informe o nome do motorista', variant: 'destructive' });
      return;
    }
    if (newDriverPassword && newDriverPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setCreatingDriver(true);
    setDriverInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-test-driver', {
        body: { driverName: newDriverName.trim(), driverPassword: newDriverPassword || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const accessLink = `${window.location.origin}/motorista/acesso/${data.accessCode}`;
      setDriverInfo({ accessCode: data.accessCode, password: data.password, fullName: data.fullName, accessLink });
      setNewDriverName('');
      setNewDriverPassword('');
      toast({ title: 'Motorista criado com sucesso!' });
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      // Refresh access codes
      const { data: codes } = await supabase.from('driver_access_codes').select('user_id, access_code, driver_password');
      if (codes) {
        const codesMap: Record<string, { accessCode: string; password: string }> = {};
        for (const c of codes) codesMap[c.user_id] = { accessCode: c.access_code, password: c.driver_password };
        setAccessCodes(codesMap);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar motorista', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingDriver(false);
    }
  };

  // Redirect drivers away from settings
  if (!roleLoading && isMotorista) {
    return <Navigate to="/motorista" replace />;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
          </div>
        </div>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Conta
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Aparência
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            )}
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dados da Conta
                </CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Atualize sua senha de acesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <ProductUnitsImporter />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <RouteHistoryImporter />
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Tema da Interface
                </CardTitle>
                <CardDescription>
                  Escolha entre tema claro ou escuro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Tema Escuro</Label>
                    <p className="text-sm text-muted-foreground">
                      Ative para usar o tema escuro (dark mode)
                    </p>
                  </div>
                  <Switch
                    checked={isDark}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Gerenciamento de Usuários
                  </CardTitle>
                  <CardDescription>
                    Gerencie permissões e status dos usuários
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Create Driver */}
                  <div className="space-y-3 p-4 rounded-lg border border-dashed border-border">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Input
                        placeholder="Nome do motorista"
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Input
                        placeholder="Senha (mín. 6 caracteres)"
                        type="password"
                        value={newDriverPassword}
                        onChange={(e) => setNewDriverPassword(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={handleCreateDriver} disabled={creatingDriver} variant="outline" className="gap-2 shrink-0">
                        <UserPlus className="h-4 w-4" />
                        {creatingDriver ? 'Criando...' : 'Criar Motorista'}
                      </Button>
                    </div>
                    {driverInfo && (
                      <div className="text-sm space-y-2 bg-muted p-3 rounded-md">
                        <p className="font-medium">{driverInfo.fullName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Link de acesso:</span>
                          <code className="text-xs bg-background px-2 py-1 rounded break-all">{driverInfo.accessLink}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(driverInfo.accessLink); toast({ title: 'Link copiado!' }); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Senha:</span>
                          <code className="text-xs bg-background px-2 py-1 rounded">{driverInfo.password}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(driverInfo.password); toast({ title: 'Senha copiada!' }); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Envie o link e a senha para o motorista.</p>
                      </div>
                    )}
                  </div>
                  {loadingUsers ? (
                    <p className="text-center text-muted-foreground py-8">
                      Carregando usuários...
                    </p>
                  ) : users.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Permissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{u.full_name || 'Sem nome'}</p>
                                {u.role === 'motorista' && accessCodes[u.user_id] && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <code className="text-xs text-muted-foreground">{accessCodes[u.user_id].accessCode}</code>
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { 
                                      const link = `${window.location.origin}/motorista/acesso/${accessCodes[u.user_id].accessCode}`;
                                      navigator.clipboard.writeText(link); 
                                      toast({ title: 'Link copiado!' }); 
                                    }}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={u.role}
                                onValueChange={(value) => handleRoleChange(u.user_id, value as AppRole)}
                                disabled={u.user_id === user?.id}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="operacional">Operacional</SelectItem>
                                  <SelectItem value="motorista">Motorista</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant={u.is_active ? 'default' : 'secondary'}>
                                {u.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleActive(u.user_id, u.is_active)}
                                disabled={u.user_id === user?.id}
                              >
                                {u.is_active ? 'Desativar' : 'Ativar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
