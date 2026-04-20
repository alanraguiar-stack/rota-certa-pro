

# Corrigir botão "Reimportar" para abrir o seletor de arquivo direto

## Problema

O botão **Reimportar** (em `src/pages/RouteDetails.tsx`, linha 147-153) hoje apenas alterna `showReimport=true`, exibindo uma segunda tela de aviso com outro botão "Carregar Novo Arquivo". Resultado: parece que "não funciona" — o usuário clica e nada acontece (ou abre uma tela intermediária inesperada).

## Solução

Tornar o botão **Reimportar** um atalho direto que:

1. **Abre o seletor de arquivo imediatamente** (`fileInputRef.current?.click()`) — sem etapa intermediária
2. A confirmação de "isso vai substituir os dados atuais" já existe em `handleADVFile` (linha 50-56) via `confirm()` nativo, então a proteção contra substituição acidental fica preservada
3. O `<input type="file">` precisa estar montado nesse card de "já importado" (hoje só existe no card de reimport e no card inicial) — adicionar uma referência ao input nesse card também

### Mudanças em `src/pages/RouteDetails.tsx`

- No card "Detalhamento importado com sucesso" (linhas 132-158):
  - Adicionar o `<input type="file" ref={fileInputRef} hidden>` dentro do card
  - Trocar `onClick={() => setShowReimport(true)}` por `onClick={() => { setShowReimport(true); fileInputRef.current?.click(); }}` — mantém o estado para o handler reconhecer que é uma reimportação intencional, mas abre o seletor imediatamente
- A tela intermediária de aviso (`if (showReimport)` linhas 161-183) pode ser **removida**, já que a confirmação nativa do `confirm()` em `handleADVFile` já protege contra substituição acidental
- Ao cancelar o seletor de arquivo (usuário fecha sem escolher), resetar `showReimport=false` para não deixar estado pendurado — fazer isso no início do `handleADVFile` quando `!file`

## Resultado

- Um clique em "Reimportar" → abre o seletor de arquivo
- Após escolher o arquivo, aparece o `confirm()` nativo perguntando se quer substituir
- Confirmando, o novo arquivo é processado e os itens substituídos
- Cancelando no seletor, nada acontece e o card volta ao estado normal

## Arquivo

- `src/pages/RouteDetails.tsx` — simplificar o componente `ADVUploadSection` removendo a etapa intermediária e ligando o botão "Reimportar" direto ao seletor de arquivo

