

# Diagnóstico: Por que a roteirização do EEF1G40 ficou ruim

## O que aconteceu

A rota atual tem 47 pedidos distribuídos em 4 caminhões selecionados:

```text
TRC1Z00 (27): Osasco + Carapicuíba        ✅ Correto (território fixo)
FDK8A66 (6):  Barueri + Jandira + Itapevi  ✅ Correto (território Barueri)
FIO0R12 (6):  Jandira + Caieiras + Itapevi + Embu  ❌ Mix de territórios
EEF1G40 (8):  Santana de Parnaíba + SP + Embu + Cajamar  ❌ Mix total
```

## Causa raiz: Territórios com poucas entregas são dissolvidos

O motor tem 5 territórios definidos, mas só 4 caminhões foram selecionados. O fluxo:

1. Os territórios Santana de Parnaíba (1 pedido) e Caieiras (1 pedido) foram ativados
2. Como ambos têm **menos de 4 entregas** (MIN_DELIVERIES=4), o Step 5d **consolida** — transfere os pedidos para o caminhão de apoio
3. Sobram pedidos de SP (Jardim Adelfiore, Jardim D'Abril, Conj. Promorar), Embu, Cajamar e Santana de Parnaíba sem caminhão com afinidade
4. O **fallback** distribui esses órfãos nos caminhões com capacidade restante, sem respeitar geografia
5. Resultado: EEF1G40 (caminhão extra sem território) recebe tudo que sobrou — Santana de Parnaíba no norte, SP no leste, Embu no sul, Cajamar no noroeste

## 3 problemas estruturais

### 1. SP neighborhoods não pertencem a nenhum neighborhoodFill válido
Os bairros Jardim Adelfiore, Jardim D'Abril e Conjunto Promorar Raposo Tavares **não estão** na lista de `neighborhoodFills` de nenhum território. Só estão cadastrados: Parque Imperial, Jaguaré e Rio Pequeno (no território Osasco). Esses 4 pedidos de SP caem como órfãos.

### 2. Embu está split entre Cotia e o fallback
O território Cotia inclui Embu nas `allowedFillCities`, mas **nenhum caminhão foi atribuído ao território Cotia** (apenas 4 caminhões selecionados, e os territórios Barueri/Osasco/Santana/Caieiras consumiram os slots). Os pedidos de Embu ficam órfãos.

### 3. Consolidação dissolve territórios legítimos
Mesmo com 1 pedido, Santana de Parnaíba e Caieiras têm caminhão atribuído. Mas a consolidação (MIN_DELIVERIES=4) os dissolve e mistura no apoio/fallback, criando rotas sem lógica geográfica.

## Correções propostas

### Correção 1: Adicionar bairros de SP faltantes ao neighborhoodFills
Adicionar Jardim Adelfiore, Jardim D'Abril e Conjunto Promorar Raposo Tavares ao território que faz sentido (Osasco ou um novo agrupamento). Assim esses pedidos deixam de ser órfãos.

### Correção 2: Consolidação inteligente — manter afinidade geográfica
Quando um território tem poucas entregas, em vez de dissolver para o apoio genérico, **mesclar com o território vizinho mais próximo**:
- Santana de Parnaíba (1 pedido) + Cajamar (1 pedido) → mesclar com Barueri (vizinho geográfico)
- Caieiras (1 pedido) → mesclar com Barueri ou manter isolado se houver caminhão sobrando

### Correção 3: Fallback com afinidade geográfica obrigatória
No fallback, exigir score mínimo de afinidade (≥50) antes de atribuir um pedido. Se nenhum caminhão tem afinidade, criar um cluster geográfico novo em vez de jogar no primeiro que tem espaço.

### Correção 4: Verificar se há território Cotia ativo
Quando Embu aparece nos pedidos mas o território Cotia não tem caminhão, os pedidos de Embu devem ir para o território vizinho mais natural (Osasco/Carapicuíba), não para o fallback genérico.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Adicionar Jardim Adelfiore, Jardim D'Abril, Conj. Promorar aos `neighborhoodFills` do território adequado |
| `src/lib/autoRouterEngine.ts` | Consolidação inteligente: mesclar com território vizinho em vez de apoio; fallback com afinidade mínima |

