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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useUserRole, useUserManagement, AppRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings as SettingsIcon, User, Shield, Moon, Sun, Users, Lock, UserPlus, Copy, CalendarDays, MapPin, Trash2 } from 'lucide-react';
import { CityScheduleTab } from '@/components/settings/CityScheduleTab';
import { TruckTerritoryTab } from '@/components/settings/TruckTerritoryTab';

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
  const { getAllUsers, updateUserRole, toggleUserActive, deleteUser } = useUserManagement();
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
  const [newUserRole, setNewUserRole] = useState<AppRole>('motorista');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
        .select('user_id, access_code');
      
      if (codes) {
        const codesMap: Record<string, { accessCode: string; password: string }> = {};
        for (const c of codes) {
          codesMap[c.user_id] = { accessCode: c.access_code, password: '' };
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

  const handleCreateUser = async () => {
    if (!newDriverName.trim()) {
      toast({ title: 'Informe o nome do usuário', variant: 'destructive' });
      return;
    }
    if (!newDriverPassword || newDriverPassword.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }

    setCreatingDriver(true);
    setDriverInfo(null);

    try {
      if (newUserRole === 'motorista') {
        // Use edge function for drivers
        const { data, error } = await supabase.functions.invoke('create-test-driver', {
          body: { driverName: newDriverName.trim(), driverPassword: newDriverPassword || undefined },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const accessLink = `${window.location.origin}/motorista/acesso/${data.accessCode}`;
        setDriverInfo({ accessCode: data.accessCode, password: data.password, fullName: data.fullName, accessLink });
      } else {
        // For admin/operacional, use signUp + role
        if (!newUserEmail.trim()) {
          toast({ title: 'Informe o e-mail para usuários admin/operacional', variant: 'destructive' });
          setCreatingDriver(false);
          return;
        }
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: newUserEmail.trim(),
          password: newDriverPassword,
          options: { data: { full_name: newDriverName.trim() } },
        });
        if (signUpError) throw signUpError;
        if (signUpData.user) {
          // Update role from default 'operacional' to chosen role
          if (newUserRole !== 'operacional') {
            await updateUserRole(signUpData.user.id, newUserRole);
          }
        }
      }

      toast({ title: 'Usuário criado com sucesso!' });
      setNewDriverName('');
      setNewDriverPassword('');
      setNewUserEmail('');
      setShowCreateDialog(false);

      // Refresh users & access codes
      const allUsers = await getAllUsers();
      setUsers(allUsers);
      const { data: codes } = await supabase.from('driver_access_codes').select('user_id, access_code');
      if (codes) {
        const codesMap: Record<string, { accessCode: string; password: string }> = {};
        for (const c of codes) codesMap[c.user_id] = { accessCode: c.access_code, password: '' };
        setAccessCodes(codesMap);
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar usuário', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingDriver(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const { error } = await deleteUser(userId);
    if (error) {
      toast({ title: error, variant: 'destructive' });
    } else {
      toast({ title: `Usuário ${userName || ''} excluído` });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    }
  };

  // Redirect drivers away from settings
  if (!roleLoading && isMotorista) {
    return <Navigate to="/motorista" replace />;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="mt-1 text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        <Tabs defaultValue="account" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Conta</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </TabsTrigger>
            <TabsTrigger value="territories" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Territórios</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden sm:inline">Aparência</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
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

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-4">
            <CityScheduleTab />
          </TabsContent>

          {/* Territories Tab */}
          <TabsContent value="territories" className="space-y-4">
            <TruckTerritoryTab />
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
                  {/* Create User Button + Dialog */}
                  <div className="flex items-center justify-between">
                    <Button onClick={() => setShowCreateDialog(true)} variant="outline" className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Criar Usuário
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

                  {/* Create User Dialog */}
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar Novo Usuário</DialogTitle>
                        <DialogDescription>Preencha os dados e escolha a categoria do usuário.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Categoria</Label>
                          <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="operacional">Operacional</SelectItem>
                              <SelectItem value="motorista">Motorista</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input
                            placeholder="Nome completo"
                            value={newDriverName}
                            onChange={(e) => setNewDriverName(e.target.value)}
                          />
                        </div>
                        {newUserRole !== 'motorista' && (
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                              placeholder="email@exemplo.com"
                              type="email"
                              value={newUserEmail}
                              onChange={(e) => setNewUserEmail(e.target.value)}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Senha</Label>
                          <Input
                            placeholder="Mínimo 6 caracteres"
                            type="password"
                            value={newDriverPassword}
                            onChange={(e) => setNewDriverPassword(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateUser} disabled={creatingDriver}>
                          {creatingDriver ? 'Criando...' : 'Criar Usuário'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

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
                          <TableHead>Código</TableHead>
                          <TableHead>Permissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <p className="font-medium">{u.full_name || 'Sem nome'}</p>
                            </TableCell>
                            <TableCell>
                              {accessCodes[u.user_id] ? (
                                <div className="flex items-center gap-1">
                                  <code className="text-xs truncate max-w-[100px]">{accessCodes[u.user_id].accessCode}</code>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { 
                                    const link = `${window.location.origin}/motorista/acesso/${accessCodes[u.user_id].accessCode}`;
                                    navigator.clipboard.writeText(link); 
                                    toast({ title: 'Link copiado!' }); 
                                  }}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : <span className="text-muted-foreground">—</span>}
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
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleActive(u.user_id, u.is_active)}
                                  disabled={u.user_id === user?.id}
                                >
                                  {u.is_active ? 'Desativar' : 'Ativar'}
                                </Button>
                                {!u.is_active && u.user_id !== user?.id && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm" className="gap-1">
                                        <Trash2 className="h-3 w-3" />
                                        Excluir
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta ação removerá permanentemente o perfil e permissões de <strong>{u.full_name || 'este usuário'}</strong>. Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(u.user_id, u.full_name || '')}>
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
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
