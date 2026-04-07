
## Plano: fazer o sistema aprender a lógica atual do TRC1Z00 e parar de cruzar Osasco

### Diagnóstico do que encontrei
Hoje o sistema já salva snapshots manuais em `route_history_patterns`, mas ainda há 3 falhas centrais:

1. **A roteirização da tela de rota atual não usa esse aprendizado**
   - `src/hooks/useRoutes.ts` chama `optimizeDeliveryOrder(...)`
   - `src/lib/routing.ts` usa ORS ou nearest-neighbor com bônus geográficos
   - esse caminho **não consome os padrões históricos aprendidos**

2. **O aprendizado atual é fraco demais para o que você quer**
   - `historyPatternEngine.ts` aprende basicamente **ordem de bairros dentro da cidade**
   - não aprende bem:
     - ordem entre blocos da própria Osasco
     - direção da rota
     - sequência de ruas/endereços
     - como inserir novas vendas sem desmontar o bloco bom

3. **A snapshot manual não está sendo tratada como “padrão ouro” completo**
   - hoje só pedidos tocados manualmente recebem peso extra
   - mas, no seu caso, quando você organiza o TRC1Z00 inteiro, a **sequência toda** deve virar referência

### O que será implementado
#### 1. Transformar a sequência manual atual do TRC1Z00 em aprendizado forte
Quando houver ajuste manual no caminhão, o sistema vai considerar o caminhão como **curado pelo analista** e aprender a sequência inteira daquele bloco, não só os itens mexidos.

Isso permitirá usar como referência o padrão que seu print mostra:
- Osasco vindo em **descida contínua**
- sem voltar para cima
- respeitando **bairro → sub-bloco → rua/endereço**
- evitando cruzamento lateral desnecessário

#### 2. Aprender em 3 níveis, não só por bairro
Vou ajustar o motor histórico para aprender:

- **ordem de cidades** dentro do caminhão
- **ordem de bairros** dentro da cidade
- **ordem de ruas/endereços** dentro do bairro/bloco

Para o caso do print, a lógica aprendida deixa de ser só “Pestana antes de Padroeira” e passa a ser algo como:
- entrar por um ponto de Osasco
- descer por blocos coerentes
- só avançar para o próximo bloco quando o atual estiver esgotado
- inserir novos pedidos no bloco correto, sem quebrar o fluxo

#### 3. Fazer a otimização da tela atual usar esse aprendizado
A rota atual precisa parar de reotimizar “cego”.

Vou alterar a otimização para:
- consultar os padrões aprendidos antes de rodar ORS/heurística
- usar o histórico manual como **ordem-base**
- só usar ORS/nearest-neighbor como apoio local, não como dono da sequência

#### 4. Inserir novas vendas sem destruir o bloco bom
Para pedidos novos ainda não roteirizados, a lógica será:

- identificar cidade e bairro
- localizar o bloco histórico correspondente
- inserir o pedido **entre vizinhos naturais**
- manter o corredor principal já aprendido

Ou seja:
- se o TRC1Z00 já tem uma descida coerente em Osasco,
- a nova venda entra no ponto compatível dessa descida,
- em vez de fazer o caminhão voltar e cruzar a cidade

#### 5. Proteger caminhões já ajustados manualmente
Além do aprendizado, vou reforçar a proteção operacional:

- caminhões bloqueados não devem ser reotimizados em nenhum fluxo
- caminhões editados manualmente não devem sofrer reordenação global agressiva
- a otimização deve ser **incremental**, não destrutiva

### Arquivos que devem ser ajustados
| Arquivo | Mudança |
|---|---|
| `src/pages/RouteDetails.tsx` | marcar caminhão ajustado manualmente como sequência validada e salvar snapshot completo |
| `src/hooks/useRoutes.ts` | fazer `optimizeRoutes` carregar/aplicar padrões aprendidos; respeitar bloqueio em todos os fluxos |
| `src/lib/historyPatternEngine.ts` | ampliar aprendizado para cidade + bairro + endereço/blocos |
| `src/lib/routing.ts` | criar otimização guiada por histórico manual antes do ORS/nearest-neighbor |
| `src/hooks/useHistoryPatterns.ts` | expor os padrões com granularidade suficiente para a roteirização atual |
| `supabase/migrations/...` | opcionalmente adicionar metadata de snapshot/manual para não perder padrão ouro do dia |

### Comportamento esperado depois
Para o TRC1Z00, quando você refizer uma sequência boa como essa do print:
- o sistema passa a entender que **Osasco deve ser percorrida em fluxo contínuo**
- aprende a ordem dos blocos
- evita mandar voltar para cima da cidade
- usa essa lógica nas próximas roteirizações
- e, ao entrar nova venda, tenta encaixá-la no trecho correto da rota já aprendida

### Resumo técnico
O problema não é só “falta de aprender”.
O principal problema é que **o aprendizado já salvo não está conectado ao motor que otimiza a rota atual**.

Então a implementação será:
1. fortalecer a captura da sequência manual
2. enriquecer o aprendizado por cidade/bairro/endereço
3. conectar esse aprendizado ao `optimizeRoutes`
4. trocar reotimização global por inserção guiada em cima do padrão manual validado
