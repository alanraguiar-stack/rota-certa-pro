

# Campo de Busca no Ajuste Manual de Rotas

## Objetivo

Adicionar um campo de busca no `TruckRouteEditor` que permite digitar nome do cliente ou endereço e localizar em qual caminhão está a entrega, com destaque visual e navegação automática para a tab correta.

## Mudanças em `src/components/route/TruckRouteEditor.tsx`

1. **Campo de busca** no header do card principal (entre o título "Ajuste Manual das Rotas" e o badge de confirmadas)
   - Input com ícone de lupa, placeholder "Buscar cliente ou endereço..."
   - Busca em tempo real (onChange) com debounce visual

2. **Lógica de busca**
   - Filtrar `client_name` e `address` de todos os pedidos de todos os caminhões (case-insensitive, normalize accents)
   - Retornar lista de matches com: nome, endereço, placa do caminhão, sequência
   - Se houver matches, mostrar dropdown de resultados abaixo do input

3. **Navegação ao clicar no resultado**
   - Trocar `activeTab` para o `routeTruckId` do caminhão que contém o pedido
   - Scrollar até o OrderCard correspondente (via ref ou `scrollIntoView`)
   - Highlight temporário no OrderCard (ring amarelo por 2 segundos)

4. **Estado de highlight no OrderCard**
   - Novo prop `isHighlighted` que aplica `ring-2 ring-amber-400 bg-amber-50/50` com transição

5. **Resultado inline (alternativa ao dropdown)**
   - Quando há texto no campo, mostrar um mini-resumo: "Encontrado em **EEF1G40** — Entrega #5" com link para navegar

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/route/TruckRouteEditor.tsx` | Campo de busca, lógica de match, navegação entre tabs, highlight no OrderCard |

