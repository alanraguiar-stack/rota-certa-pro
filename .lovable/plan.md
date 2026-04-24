
# Corrigir o romaneio de carga da última roteirização da Caroline e blindar a importação ADV

## O que a revisão mostrou

- A última rota da Caroline (`24.04.2026`) tem **67 pedidos**, mas apenas **13 `order_items`** salvos no banco, distribuídos em só **4 pedidos**. O romaneio está errado porque **os itens não foram vinculados à maioria dos pedidos**.
- O problema não está só na tela: o dado persistido da rota já veio incompleto.
- No CSV enviado como exemplo, a **quantidade está na coluna M** e o número da venda aparece deslocado mais à direita no cabeçalho, então o parser precisa parar de depender de posição fixa frágil.
- Hoje não há cadastros salvos de unidade para a Caroline nos produtos direcionados; o sistema está dependendo demais de inferência, e parte da hierarquia de prioridade está inconsistente entre importação e romaneio.

## Plano de correção

### 1) Blindar a importação ADV para não aceitar cruzamento parcial silencioso
Ajustar o fluxo de reimportação para:
- medir quantos pedidos do ADV foram parseados
- medir quantos pedidos da rota receberam itens de fato
- exibir alerta forte quando o vínculo ficar muito baixo
- impedir que uma reimportação claramente incompleta substitua silenciosamente os itens já existentes

Arquivos:
- `src/hooks/useRoutes.ts`
- `src/pages/RouteDetails.tsx`

### 2) Corrigir o parser CSV principal para usar layout real do “Vendas Detalhadas”
No `parseVendasCSV`:
- manter **coluna M (`partes[12]`)** como fonte principal da quantidade
- manter fallback legado apenas como segurança
- corrigir a captura do **número da venda** para procurar o primeiro número válido após o rótulo, em vez de depender de índice fixo antigo
- alinhar a lógica do parser principal com o fallback dinâmico, para os dois seguirem a mesma regra de layout atual

Arquivo:
- `src/lib/advParser.ts`

### 3) Corrigir o parser Excel para parar de “adivinhar” quantidade errada
No `parseADVDetailExcel`:
- quando a coluna **Qtde** for detectada no layout atual, usar essa coluna como fonte autoritativa
- evitar cair em heurísticas que escolhem “o primeiro número da linha”, porque isso pode puxar preço unitário/total
- remover o comportamento permissivo de defaultar item para quantidade `1` quando o layout atual foi reconhecido, pois isso mascara erro de leitura
- manter fallbacks só para layouts realmente antigos ou fora do padrão

Arquivo:
- `src/lib/advParser.ts`

### 4) Unificar a regra de unidade para obedecer os direcionamentos em todo o sistema
Padronizar a hierarquia em todos os pontos:
1. marcador explícito forte no nome  
2. cadastro salvo do produto  
3. regra por categoria/marca  
4. default `kg`

Aplicar a mesma regra em:
- importação ADV
- cadastro/inferência automática
- consolidação do romaneio de carga
- cards/manifests alternativos

Isso evita que a tela do romaneio “ignore” correções e também evita divergência entre o que foi importado e o que foi exibido.

Arquivos:
- `src/hooks/useProductUnits.ts`
- `src/lib/advParser.ts`
- `src/components/route/LoadingManifest.tsx`
- `src/components/route/TruckManifestCards.tsx`

### 5) Garantir que os direcionamentos de unidade tenham precedência real
Consolidar explicitamente as regras já passadas:
- qualquer **CAFÉ** → `fardo`
- qualquer **FARINHA** → `fardo`
- **MOLHO DE TOMATE** → `pacote`
- **SALSICHA** → `kg`
- **BISTECA** → `kg`
- **APRESUNTADO** → `kg`
- **KETCHUP PREDILECTA** / ketchup direcionado → `unidade`
- **MAIONESE HELLMANNS** / maionese direcionada → `unidade`

Além disso:
- não deixar o romaneio sobrescrever uma unidade válida já salva com inferência mais fraca
- normalizar comparação sem acento para garantir consistência

## Reparação da rota já afetada
Depois da correção de código:
- reimportar o ADV da última rota da Caroline para reconstruir os `order_items`
- validar que a rota deixe de ter 63 pedidos sem itens
- só então regenerar o romaneio de carga

Importante:
- a rota atual já está salva com dados incompletos; **só corrigir a tela não resolve**
- para recuperar totalmente essa roteirização, será necessário usar novamente o arquivo ADV correto dessa data

## Validação final
Após implementar:
- confirmar que a quantidade sai da **coluna M**
- confirmar que o parser não está lendo preço/total como quantidade
- conferir produtos-chave com as unidades dirigidas
- verificar que o romaneio de carga da Caroline passa a listar itens em todos os caminhões, e não só em poucos pedidos

## Detalhes técnicos
```text
Achado principal da revisão:
- Rota 24.04.2026
- 67 pedidos
- apenas 13 order_items
- apenas 4 pedidos com itens detalhados

Conclusão:
- o problema é de importação/persistência do ADV
- não é apenas um erro visual do romaneio
```
