

# Usar ícones reais do Google Maps e Waze nos botões de navegação

## Problema

Atualmente os botões de navegação usam ícones genéricos do Lucide (`Map` e `Navigation`), que não são imediatamente reconhecidos como Google Maps e Waze. O usuário enviou os logos oficiais para tornar a interface mais intuitiva.

## Solução

### 1. Copiar ícones para o projeto

Copiar as imagens enviadas para `public/icons/`:
- `user-uploads://image-41.png` → `public/icons/google-maps.png`
- `user-uploads://image-42.png` → `public/icons/waze.png`

### 2. Atualizar DeliveryCard.tsx

Substituir os ícones Lucide pelas imagens reais:
- Botão Google Maps: usar imagem do pin do Google Maps com borda azul (#4285F4) no hover
- Botão Waze: usar imagem do fantasminha do Waze com borda azul-claro (#33ccff) no hover
- Aumentar tamanho dos botões para `h-9 w-9` para acomodar as imagens
- Adicionar padding interno `p-1.5` para as imagens não ficarem coladas nas bordas
- Remover ícones Lucide `Map` e `Navigation` das importações (não usados mais)

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `public/icons/google-maps.png` | Novo arquivo - logo do Google Maps |
| `public/icons/waze.png` | Novo arquivo - logo do Waze |
| `src/components/driver/DeliveryCard.tsx` | Usar imagens reais nos botões de navegação |

