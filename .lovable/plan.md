

# Plano: Reformular Romaneio de Carga para Formato ADV

## Objetivo
Alinhar o PDF do Romaneio de Carga ao modelo oficial do ADV, consolidando itens por produto com a unidade de medida correta (KG, CX, FD, UN).

## Formato Alvo (baseado no PDF modelo)

```text
| #  | Descrição                                    | UN | Qtde   |
|----|----------------------------------------------|----|--------|
| 1  | FARINHA DE MANDIOCA - PLAZA - GROSSA 0,5 KG  | FD |   1    |
| 2  | FRANGO - SEARA - 20 KG - S MIUDOS           | KG |  60    |
| 3  | MUSSARELA - ESPLANADA - 4 KG                | KG |  59,67 |
| 4  | OLEO DE SOJA REFINADO VITALIV 900ML          | UN | 180    |
```

- Itens com UN=KG/g: Qtde = soma dos pesos (weight_kg)
- Itens com UN=CX/FD/UN/etc: Qtde = soma das quantidades (quantity)
- Ordenação alfabética por Descrição
- Header: N° Itinerário, Data, Placa (como no modelo)
- Lista de vendas incluídas no topo
- Assinatura no rodapé

## Mudanças

### Arquivo: `src/components/route/LoadingManifest.tsx`

**1. Refatorar `consolidateProducts`**
- Para itens com unidade de peso (kg, g): consolidar somando `weight_kg`
- Para itens volumétricos (CX, FD, UN, etc): consolidar somando `quantity`
- A unidade exibida vem de `getUnitForProduct` (que consulta `product_units` no banco) ou `inferUnitFromName`
- Mapear abreviações: caixa→CX, fardo→FD, unidade→UN, kg→KG

**2. Refatorar `generateLoadingManifestPDF`**
- Trocar colunas de `[#, Produto, Qtde, Unidade, Peso Total]` para `[#, Descrição, UN, Qtde]`
- Formatar Qtde: decimais para KG (ex: 59,67), inteiros para volumétricos
- Adicionar lista de vendas (sale IDs) no cabeçalho, se disponível nos orders
- Remover coluna "Peso Total" separada — a quantidade já representa o volume correto

**3. Atualizar preview na UI**
- Alinhar a visualização em tela com o mesmo formato do PDF

### Arquivo: `src/hooks/useProductUnits.ts`
- Adicionar helper `getUnitAbbrev(unitType)` que mapeia nomes longos para abreviações: `caixa→CX`, `fardo→FD`, `unidade→UN`, `kg→KG`, `pacote→PCT`, `litro→LT`, `saco→SC`, `display→DP`, `peca→PC`, `garrafa→GF`

## Lógica de Consolidação (detalhe)

```text
Para cada order do caminhão:
  Para cada item do order:
    unitType = getUnitForProduct(item.product_name)
    Se unitType é peso (kg/g):
      acumular weight_kg no mapa por product_name
    Senão:
      acumular quantity no mapa por product_name
    
Resultado: lista de {descrição, UN (abreviada), qtde}
Ordenar alfabeticamente
```

## Impacto
- PDF gerado seguirá o padrão ADV fielmente
- Unidades corretas consultadas do banco `product_units`
- Preview na tela alinhado com o PDF

