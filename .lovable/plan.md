

# Diagnóstico: Tela voltando sozinha durante seleção de caminhões

## Causa raiz identificada

O problema está no **AuthContext.tsx**. Quando o token de autenticação é renovado automaticamente (token refresh), o listener `onAuthStateChange` recebe um evento `TOKEN_REFRESHED` que pode momentaneamente definir `session` como `null`. Isso faz o `AppLayout` detectar `user === null` e redirecionar para `/landing`.

Nos logs de auth, o evento `token_revoked` confirma isso: o Supabase está fazendo refresh do token enquanto o usuário está na tela, causando um ciclo momentâneo de `user = null → redirect`.

Adicionalmente, há um risco secundário no `useEffect` do `IntelligentFleetPanel.tsx` (linhas 72-81) que chama `onSelectionChange` com dependência em `selectedTruckIds.length`, podendo causar re-renders desnecessários, mas isso não causa o redirect.

## Correção

### 1. `src/contexts/AuthContext.tsx` — Proteger contra transições de token

- No `onAuthStateChange`, verificar o tipo do evento antes de limpar o estado do usuário
- Só definir `user = null` se o evento for explicitamente `SIGNED_OUT`
- Para eventos `TOKEN_REFRESHED`, `INITIAL_SESSION`, etc., só atualizar se a session não for null
- Isso impede que um refresh de token cause redirect momentâneo

### 2. `src/components/route/IntelligentFleetPanel.tsx` — Estabilizar useEffect

- Adicionar guard no `useEffect` para não re-executar `onSelectionChange` quando já há uma seleção válida
- Usar referência estável para `onSelectionChange` com `useCallback` no componente pai ou guardar com ref

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/contexts/AuthContext.tsx` | Proteger `onAuthStateChange` contra token refresh que zera o user |
| `src/components/route/IntelligentFleetPanel.tsx` | Estabilizar useEffect de auto-seleção |

