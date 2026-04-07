
# Plano: Corrigir botão branco e melhorar frase da Landing Page

## Problema
O botão "Ver demonstração" no hero da landing page aparece branco (variant outline com borda branca sutil), quase invisível contra o fundo escuro. A frase principal também precisa ser substituída.

## Mudanças

### 1. Botão "Ver demonstração" (linha 182)
Trocar de `variant="outline"` com borda branca para um estilo com fundo semi-transparente laranja, tornando-o visível e harmonizado com o tema.

### 2. Frase principal do hero (linhas 163-168)
Substituir "Planeje, execute e comprove suas entregas em um só lugar." por algo mais impactante e direto:

**Nova frase:** "Sua logística no controle. Do pedido à prova de entrega."

A parte em gradiente laranja será "Do pedido à prova de entrega."

### 3. Verificar outros botões brancos
O botão "Entrar" na navbar (linha 105) usa `variant="ghost"` com texto claro — está OK para navbar. O botão "Entrar" do menu mobile (linha 124) tem `variant="outline"` com `border-white/20` — vou ajustá-lo também para ficar mais visível.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Trocar estilo dos botões outline + nova frase do hero |
