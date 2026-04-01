

# Plano: Remover Geocodificação Obrigatória do Wizard

## Problema
A geocodificação via Nominatim demora ~1.1s por endereço (rate limit da API). Para 64 pedidos = ~70 segundos bloqueando o fluxo. O motor de roteirização já funciona perfeitamente com coordenadas estimadas (baseadas em CEP/bairro/cidade).

## Solução
Remover a etapa de geocodificação do fluxo principal do wizard. O sistema usará as coordenadas estimadas internas para distribuição e roteirização — que já é o que acontece quando a geocodificação falha.

## Mudanças

### `src/pages/NewRoute.tsx`
- Remover todo o bloco de geocodificação (linhas 145-195): loop do Nominatim, progress state, toast
- Remover o state `geocodingProgress` e o import de `GeocodingProgress`
- Remover o import de `geocodeAddress` do `nominatimGeocoding`
- Remover o componente `<GeocodingProgress>` do JSX (linhas 441-449)
- O fluxo passa direto de "filtrar pedidos" para "auto-compose trucks"

### Resultado
- Wizard instantâneo — sem espera de 70+ segundos
- Roteirização mantém a mesma qualidade (estimativa por CEP já agrupa corretamente)
- Nenhum outro arquivo afetado

