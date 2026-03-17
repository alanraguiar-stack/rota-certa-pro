

# Rebalanceamento Iterativo com Coerência Geográfica

## Problema

A função `rebalanceInternalTrucks` em `autoRouterEngine.ts` faz apenas **uma única passagem** entre o caminhão mais carregado e o menos carregado. Com MAX_DIFF=3, só dispara quando a diferença é >4. Resultado: EEF1G40 fica com 4 entregas enquanto outros têm 17-21.

Além disso, o Step 5d (consolidação) move caminhões com <15 entregas para o apoio, o que pode estar agravando o desbalanceamento.

## Solução

Reescrever `rebalanceInternalTrucks` com lógica iterativa e seleção geográfica inteligente.

### Mudanças em `src/lib/autoRouterEngine.ts`

**1. Rebalanceamento iterativo (loop até convergir)**
- Em vez de uma única passagem most→least, fazer loop: a cada iteração, identificar o caminhão com mais entregas e o com menos, mover pedidos até que a diferença entre qualquer par seja ≤ MAX_DIFF (3)
- Máximo de 10 iterações para evitar loops infinitos

**2. Seleção inteligente de pedidos para mover**
- Ao escolher quais pedidos mover do caminhão mais cheio para o menos cheio:
  - **Priorizar pedidos que compartilham cidade/bairro/rua** com o caminhão destino (coerência geográfica)
  - Score de afinidade: mesma rua = 100, mesmo bairro = 50, mesma cidade = 20, cidade vizinha = 10
  - Mover os pedidos com maior afinidade com o caminhão destino primeiro
  - Nunca mover pedidos da cidade âncora do caminhão de origem

**3. Proteção de caminhões fixos**
- Excluir caminhões com `fixedPlate` (como TRC1Z00) do rebalanceamento — não recebem nem cedem pedidos
- Isso atende ao requisito do usuário de não mexer no TRC1Z00

**4. Ajuste do Step 5d (consolidação)**
- Reduzir `MIN_DELIVERIES` de 15 para 8 para evitar que caminhões com poucas entregas (mas legítimas) sejam esvaziados antes do rebalanceamento

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/lib/autoRouterEngine.ts` | Reescrever `rebalanceInternalTrucks` com loop iterativo, afinidade geográfica e proteção de fixedPlate; ajustar MIN_DELIVERIES |

