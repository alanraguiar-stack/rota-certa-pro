import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers';
import { useUserManagement, type AppRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Users, KeyRound, Mail, Eye, EyeOff, Copy, Shield, Truck, UserCog, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  admin:       { label: 'Admin',       icon: <Shield className="h-3 w-3" />,   className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  operacional: { label: 'Operacional', icon: <UserCog className="h-3 w-3" />,  className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  motorista:   { label: 'Motorista',   icon: <Truck className="h-3 w-3" />,    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? { label: role, icon: null, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

interface ResetPasswordDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (userId: string, password: string) => Promise<boolean>;
  loading: boolean;
}

function ResetPasswordDialog({ user, onClose, onConfirm, loading }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  const handleConfirm = async () => {
    if (!user || password !== confirm || password.length < 6) return;
    const ok = await onConfirm(user.id, password);
    if (ok) { setPassword(''); setConfirm(''); onClose(); }
  };

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Redefinir Senha
          </DialogTitle>
          <DialogDescription>
            Definindo nova senha para <span className="font-medium text-foreground">{user?.full_name ?? user?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="rp-pwd">Nova senha</Label>
            <div className="relative">
              <Input
                id="rp-pwd"
                type={show ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(!show)}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirmar senha</Label>
            <Input
              id="rp-confirm"
              type={show ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className={mismatch ? 'border-destructive' : ''}
            />
            {mismatch && <p className="text-xs text-destructive">As senhas não coincidem</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || password.length < 6 || password !== confirm}
          >
            {loading ? 'Salvando...' : 'Salvar Senha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditEmailDialogProps {
  user: AdminUser | null;
  onClose: () => void;
  onConfirm: (userId: string, email: string) => Promise<boolean>;
  loading: boolean;
}

function EditEmailDialog({ user, onClose, onConfirm, loading }: EditEmailDialogProps) {
  const [email, setEmail] = useState(user?.email ?? '');

  const handleConfirm = async () => {
    if (!user || !email.includes('@')) return;
    const ok = await onConfirm(user.id, email);
    if (ok) onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Editar E-mail
          </DialogTitle>
          <DialogDescription>
            Alterando e-mail de <span className="font-medium text-foreground">{user?.full_name ?? user?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <Label htmlFor="edit-email">Novo e-mail</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="novo@email.com"
          />
          <p className="text-xs text-muted-foreground">O e-mail será confirmado automaticamente.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || !email.includes('@')}>
            {loading ? 'Salvando...' : 'Salvar E-mail'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsersTab() {
  const { users, isLoading, isError, error, resetPassword, updateEmail, resettingId, updatingEmailId } = useAdminUsers();
  const { toggleUserActive, deleteUser } = useUserManagement();
  const { toast } = useToast();

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [emailTarget, setEmailTarget] = useState<AdminUser | null>(null);
  const [filter, setFilter] = useState('');

  const filtered = users.filter(u =>
    !filter ||
    u.full_name?.toLowerCase().includes(filter.toLowerCase()) ||
    u.email?.toLowerCase().includes(filter.toLowerCase()) ||
    u.role.includes(filter.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Carregando usuários...
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    const msg = error?.message ?? '';
    const isNotDeployed = msg.includes('Failed to fetch') || msg.includes('FunctionNotFound') || msg.includes('404') || msg.includes('relay');
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 mx-auto">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <p className="font-medium text-sm">
            {isNotDeployed ? 'Edge Function não deployada' : 'Erro ao carregar usuários'}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {isNotDeployed
              ? 'A função manage-users precisa ser deployada no Supabase. Acesse Supabase → Edge Functions → manage-users → Deploy.'
              : msg}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciamento de Usuários
              </CardTitle>
              <CardDescription className="mt-1">
                Visualize e edite email, senha e dados de todos os usuários.
              </CardDescription>
            </div>
            <Input
              placeholder="Buscar por nome, email ou role..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Usuário</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">E-mail</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Role</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Acesso</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Último login</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className={cn('border-b border-border last:border-0 hover:bg-muted/30 transition-colors', !u.is_active && 'opacity-50')}>
                    {/* Nome */}
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.full_name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">desde {formatDate(u.created_at)}</div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground max-w-[180px] truncate">{u.email ?? '—'}</span>
                        {u.email && (
                          <button
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            onClick={() => { navigator.clipboard.writeText(u.email!); toast({ title: 'E-mail copiado!' }); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* Código de acesso (motoristas) */}
                      {u.access_code && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-muted-foreground">Código:</span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{u.access_code}</code>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => { navigator.clipboard.writeText(u.access_code!); toast({ title: 'Código copiado!' }); }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="h-3.5 w-3.5" /> Inativo
                        </span>
                      )}
                    </td>

                    {/* Último login */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatDate(u.last_sign_in_at)}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setEmailTarget(u)}
                          disabled={!!updatingEmailId}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          E-mail
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setResetTarget(u)}
                          disabled={resettingId === u.id}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Senha
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado{filter ? ` para "${filter}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onConfirm={resetPassword}
        loading={resettingId === resetTarget?.id}
      />
      <EditEmailDialog
        user={emailTarget}
        onClose={() => setEmailTarget(null)}
        onConfirm={updateEmail}
        loading={updatingEmailId === emailTarget?.id}
      />
    </>
  );
}
