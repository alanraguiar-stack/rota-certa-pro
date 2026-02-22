

# Landing Page Completa - Rota Certa

## Visao Geral

Criar uma landing page publica completa com todas as 10 secoes solicitadas, acessivel sem autenticacao. A pagina seguira o design system existente (Deep Navy, Teal, Coral Orange) e sera otimizada para conversao.

## Arquitetura de Roteamento

Atualmente, `/` requer autenticacao (dashboard). A landing page sera criada em uma nova rota `/landing` e o fluxo sera ajustado:

- Usuarios nao autenticados acessando `/` serao redirecionados para `/landing` em vez de `/login`
- `/login` continua existindo para acesso direto
- `/landing` e publica (sem autenticacao)
- CTAs da landing levam para `/login`

**Arquivos afetados:**
| Arquivo | Mudanca |
|---------|---------|
| `src/pages/LandingPage.tsx` | **Novo** - Pagina completa com as 10 secoes |
| `src/App.tsx` | Adicionar rota `/landing` |
| `src/components/layout/AppLayout.tsx` | Redirecionar para `/landing` em vez de `/login` |

## Estrutura das 10 Secoes

### 1. Hero Section (acima da dobra)
- Background escuro com mesh gradient (reutiliza `bg-mesh-gradient` existente)
- Headline: "Planeje, execute e comprove suas entregas em um so lugar."
- Subheadline e texto de apoio
- 2 CTAs: "Comecar agora" (gradiente CTA) e "Ver demonstracao" (outline)
- Animacao SVG de rotas reutilizando o padrao do Auth.tsx
- Icones flutuantes de caminhao, pacote, pin

### 2. Para Quem E
- Fundo claro com cards/badges
- Icones representando cada segmento (Distribuidoras, Food Service, etc.)
- Layout em grid responsivo

### 3. O Problema
- Cards com icones e texto descritivo
- Fundo com gradiente sutil
- 5 cards: planejamento manual, erros de rota, sobrecarga, falta de controle, falta de comprovacao

### 4. Como Funciona
- 4 etapas visuais conectadas (1 -> 2 -> 3 -> 4)
- Cada etapa com icone, titulo e descricao curta
- Linha conectora entre etapas (horizontal em desktop, vertical em mobile)

### 5. Beneficios
- Grid de 5 cards com icones
- Cada card com titulo e descricao curta
- Hover effects usando `hover-lift` existente

### 6. Features
- 3 colunas: Planejamento, Operacao, Controle
- Cada coluna com lista de features com checkmarks
- Fundo alternado para diferenciar

### 7. Planos e Precos
- 3 cards lado a lado: Free, Premium, Pro
- Premium destacado (borda accent, badge "Mais popular")
- Lista de features com check/x para cada plano
- CTAs individuais

### 8. Diferencial
- Secao com fundo escuro (hero-gradient)
- Texto impactante com destaque em accent
- Icone ou ilustracao lateral

### 9. CTA Final
- Fundo gradiente accent
- Headline forte
- 2 botoes: "Testar gratuitamente" e "Ver demonstracao"

### 10. Rodape
- Fundo escuro
- Logo, links (Termos, Privacidade, Contato, Suporte)
- Copyright

## Detalhes Tecnicos

### Componente LandingPage.tsx
- Componente unico com todas as secoes (sem AppLayout, sem sidebar)
- Navbar fixa no topo com logo + botoes "Entrar" e "Comecar gratis"
- Scroll suave entre secoes usando IDs de ancora
- Totalmente responsivo (mobile-first)
- Reutiliza classes CSS existentes: `bg-mesh-gradient`, `bg-hero-gradient`, `glass-card`, `btn-cta`, `hover-lift`, `shadow-elevated`, `glow-accent`, `animate-fade-in-up`
- Icones do lucide-react ja instalado

### Roteamento (App.tsx)
- Adicionar: `<Route path="/landing" element={<LandingPage />} />`
- Importar o novo componente

### Redirect (AppLayout.tsx)
- Alterar `<Navigate to="/login" replace />` para `<Navigate to="/landing" replace />`
- Assim, qualquer acesso autenticado que falhe leva a landing em vez do login direto

### Responsividade
- Mobile: secoes empilhadas, 1 coluna
- Tablet: 2 colunas onde aplicavel
- Desktop: layout completo com grids de 3-4 colunas

### Performance
- Sem dependencias novas
- Animacoes CSS ja existentes no index.css
- Lazy loading nao necessario (pagina unica)

