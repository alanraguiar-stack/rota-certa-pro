

# Três melhorias: Acesso do Motorista, Fluxo de Rota e Distribuição

## 1. Acesso simplificado do motorista (sem email)

### Situação atual
Motoristas são criados via edge function com email fictício (`motorista_teste_X@rotacerta.test`) e fazem login pela tela padrão com email+senha. Isso é complexo e pouco prático.

### Solução
Criar um sistema de **código de acesso** para motoristas. O admin cria o motorista informando apenas o nome, e o sistema gera um código único (ex: `RC-4827`). O admin compartilha um link como `https://app.../motorista/acesso/RC-4827` — o motorista abre, digita a senha e já acessa seu dashboard.

**Banco de dados:**
- Nova tabela `driver_access_codes` com colunas: `id`, `user_id` (ref auth.users), `access_code` (unique, ex: `RC-4827`), `created_at`
- RLS: admin pode inserir/ler, motorista pode ler apenas o próprio

**Edge function `create-test-driver`:**
- Gerar um `access_code` aleatório (formato `RC-XXXX`)
- Inserir na tabela `driver_access_codes`
- Retornar o código e o link completo em vez de email/senha

**Nova página `/motorista/acesso/:code`:**
- Recebe o código da URL
- Busca o `user_id` associado ao código na tabela `driver_access_codes`
- Mostra campo de senha (pré-definida na criação)
- Faz login via `signInWithPassword` usando o email interno (oculto do motorista)
- Redireciona para `/motorista`

**Settings.tsx:**
- Ao criar motorista, mostrar o **link de acesso** com botão de copiar, em vez de email/senha

**Auth.tsx / App.tsx:**
- Nova rota `/motorista/acesso/:code`

## 2. Fluxo de rota do motorista

### 2a. "Iniciar" abre Google Maps com todas as paradas

Isso **já funciona** — o `handleStartRoute` no `DriverDashboard.tsx` (linha 52-67) já abre o Google Maps com todos os pending stops. Porém, posso melhorar:

- Usar `origin=current+location` em vez do endereço do CD (motorista pode não estar no CD)
- Garantir que as paradas estejam na ordem correta (delivery_sequence)

### 2b. Check de entregas — simplificar

Atualmente o motorista precisa de **assinatura + foto + observações** para confirmar. Isso é pesado no dia a dia.

**Mudança no `DeliveryConfirmation.tsx`:**
- Tornar assinatura e foto **opcionais** (não obrigatórias)
- Adicionar um botão rápido "Entregue" que confirma sem provas (apenas com observação opcional)
- Manter a opção de adicionar foto/assinatura para quem quiser
- Adicionar botão "Não entregue" direto na mesma tela

**Mudança no `DriverDashboard.tsx`:**
- Adicionar botões de ação rápida diretamente no card de entrega (check ✓ e ✗) sem precisar navegar para outra página
- Manter a opção de clicar no card para ir à tela de detalhes/provas

## 3. Melhor distribuição de entregas entre caminhões

### Problema
Na imagem: EKH9I03 tem 21 entregas (1396 kg) e TRC1Z00 tem 25 entregas (2826 kg). Diferença grande de peso e quantidade. O terceirizado (FDK8A66, 6 entregas) está correto.

### Causa
O `autoRouterEngine.ts` aloca por território sem balancear entre os caminhões não-terceirizados. Osasco (TRC1Z00) acumula mais pedidos por ter exceções de bairro e prioridades.

### Solução
Adicionar uma etapa de **rebalanceamento** após a alocação territorial:

**`src/lib/autoRouterEngine.ts` — Nova etapa entre Step 5 e Step 6:**
- Identificar caminhões "internos" (não terceirizados/apoio)
- Se a diferença de entregas entre o mais carregado e o menos carregado for > 4:
  - Mover pedidos de cidades de fill/vizinhas do caminhão mais cheio para o menos cheio
  - Respeitar: não mover pedidos da cidade âncora, apenas fill cities ou neighborhood exceptions
  - Limitar a diferença a no máximo 3 entregas
- Também balancear por peso quando a diferença > 40%

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| **Nova** migração SQL | Tabela `driver_access_codes` |
| `supabase/functions/create-test-driver/index.ts` | Gerar access_code + inserir na tabela |
| **Nova** `src/pages/DriverAccess.tsx` | Página de login por código |
| `src/App.tsx` | Nova rota `/motorista/acesso/:code` |
| `src/pages/Settings.tsx` | Mostrar link de acesso em vez de email |
| `src/pages/DriverDashboard.tsx` | Usar `current+location` como origin, botões de ação rápida nos cards |
| `src/pages/DeliveryConfirmation.tsx` | Foto e assinatura opcionais, botão rápido |
| `src/components/driver/DeliveryCard.tsx` | Botões de ação rápida (check/não entregue) |
| `src/lib/autoRouterEngine.ts` | Etapa de rebalanceamento pós-alocação |

