
# Plano: Corrigir botões brancos nos cards de preço e alinhar

## Problema
Os botões "Começar grátis" (plano Free, linha 356) e "Falar com vendas" (plano Pro, linha 397) usam `variant="outline"` com `border-white/20`, ficando quase invisíveis no fundo escuro. Além disso, os botões não estão alinhados verticalmente entre os 3 cards porque as listas têm alturas diferentes.

## Mudanças

### 1. Botões dos planos Free e Pro (linhas 356 e 397)
Trocar de `variant="outline" border-white/20` para estilo semi-transparente laranja (mesmo padrão aplicado ao botão "Ver demonstração" do hero):
```
background: rgba(249,115,22,0.25)
border: 1px solid rgba(249,115,22,0.4)
```

### 2. Alinhamento vertical dos botões
Adicionar `flex flex-col` nos cards e `mt-auto` no Link dos botões, para que os 3 botões fiquem sempre alinhados na base, independente do tamanho da lista de features.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Linhas 343-399: flex layout nos cards + estilo laranja nos botões Free e Pro |
