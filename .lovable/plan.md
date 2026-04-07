
# Plano para destravar a publicação

## Diagnóstico atual
O projeto já está publicado e público:
- URL publicada: `https://rotacertapro.lovable.app`
- Visibilidade efetiva: `public`

O problema não parece ser a publicação em si, e sim o painel de segurança/publicação ainda mostrar alertas pendentes.

## O que encontrei
Há 2 pontos principais:

1. Os resultados de segurança estão desatualizados  
Todos os scanners retornam `up_to_date: false`, então a interface pode continuar mostrando alertas antigos mesmo depois das correções.

2. Ainda existe 1 finding ativo de verdade  
O único finding não ignorado que ainda apareceu foi:
- `SUPA_auth_leaked_password_protection`
- Nome: `Leaked Password Protection Disabled`

Os findings sobre `login_attempts` já estão ignorados corretamente e não deveriam mais ser o bloqueio real.

## Plano de ação

### 1. Atualizar o estado real da segurança
Executar um novo scan completo de segurança para forçar a sincronização dos findings resolvidos/ignorados.

### 2. Resolver o único alerta restante
Ativar a proteção contra senhas vazadas nas configurações de autenticação do backend:
- Cloud → Users → Auth settings
- Email settings
- ativar `Password HIBP Check`

Isso elimina o warning restante do scanner Supabase/Lovable Cloud.

### 3. Validar que os findings antigos sumiram
Depois do re-scan:
- confirmar que os warnings de `login_attempts` continuam ignorados
- confirmar que não restam findings ativos em nível `error` ou `warn`

### 4. Reabrir a publicação
Com o scan atualizado e o warning restante resolvido:
- reabrir o diálogo de Publish
- clicar em `Update` se houver mudanças de frontend pendentes

## Detalhes técnicos
O estado atual indica:

- `login_attempts_no_policy`: ignorado
- `login_attempts_no_select_policy`: ignorado
- `SUPA_rls_enabled_no_policy`: ignorado
- `SUPA_auth_leaked_password_protection`: ainda ativo

Ou seja, o problema não é mais RLS da tabela `login_attempts`; o ponto que ainda falta tratar é a proteção contra senhas vazadas e depois forçar um scan novo para limpar o painel.

## Resultado esperado
Após essas duas ações:
1. novo scan
2. ativação do leaked password protection

o painel deve parar de exibir os alertas antigos como pendentes, e a publicação deve seguir normalmente.

## Arquivos/camadas impactadas
- Nenhum arquivo frontend necessariamente
- Configuração de autenticação no backend
- Estado dos findings no painel de segurança

## Observação importante
Como o projeto já está com URL pública ativa, o bloqueio é de conformidade/estado do painel, não de disponibilidade do site. O objetivo aqui é limpar o status de segurança para que o Publish deixe de acusar pendências.
