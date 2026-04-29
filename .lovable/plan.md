## Mudanças a aplicar

### 1. Auto-avanço para o próximo caminhão (`src/components/route/TruckRouteEditor.tsx`)
- Após "Confirmar Rota" travar com sucesso o caminhão atual, mudar automaticamente o `activeTab` para o próximo caminhão ainda não confirmado.
- Se todos estiverem confirmados, manter na aba atual (não forçar navegação).

### 2. Regra STEAK FRANGO → caixa (`src/hooks/useProductUnits.ts`)
- Em `getCategoryRule`, adicionar:
  ```ts
  if (/STEAK.*FRANGO|FRANGO.*STEAK/.test(upper)) return 'caixa';
  ```
- Precedência absoluta sobre cadastro/marcador, igual às outras regras de negócio.

### 3. Guarda de "preço-como-quantidade" (`src/lib/advParser.ts`)
- Para itens não-peso (CX, UN, FD, PCT, SC, DP), se a quantidade vier fracionária (ex.: `16,99`), assumir que foi lida da coluna errada (preço unitário).
- Recuperação:
  - Se `total > 0` e `unitPrice > 0`: `qty = Math.round(total / unitPrice)`
  - Senão: `qty = Math.round(qty)` com `console.warn`.
- Itens em KG continuam aceitando decimais normalmente.
- Aplicar no parser CSV e no parser Excel ADV.

### Arquivos
- `src/components/route/TruckRouteEditor.tsx`
- `src/hooks/useProductUnits.ts`
- `src/lib/advParser.ts`
