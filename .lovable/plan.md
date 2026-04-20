

# Corrigir leitura de quantidade no parser ADV CSV (formato Vendas Detalhadas)

## Causa do erro

No arquivo `VENDAS_DETALHADAS_*.csv`, **o cabeçalho e as linhas de dados estão desalinhados por uma coluna** nos campos numéricos da direita:

```
Linha cabeçalho (12):  Código;;;Descrição;;;;;;;;;;Qtde.;Unitário;;;Total;;
                       [0]      [3]              [13] [14]    [17]

Linha de dados   (14): 1014;;;LINGUIÇA...;;;;;;;;;10;21,99;;;219,90;;
                       [0]    [3]              [12][13]   [16]
```

A `Qtde.` aparece em `[13]` no cabeçalho mas o **valor real fica em `[12]` (coluna M)**. O fallback dinâmico atual (`parseVendasCSVDynamic` em `src/lib/advParser.ts`, linhas 1693-1745) mapeia os índices pela posição do cabeçalho, então acaba lendo `21,99` (preço unitário, coluna N) como se fosse a quantidade. Resultado: romaneio sai com quantidades infladas/erradas.

## Correção

Em `src/lib/advParser.ts`, dentro de `parseVendasCSVDynamic`:

1. Após detectar a linha de cabeçalho (`Código`/`Descrição`/`Qtde`), além de salvar `qtyIdx` (posição do header), salvar também `unitarioIdx` e `totalIdx` (posição dos demais headers à direita).

2. Na primeira linha de item válida, **verificar o alinhamento**: se `partes[qtyIdx]` parece um preço (valor com `,XX` decimal típico de dinheiro, ex: `21,99`) e `partes[qtyIdx - 1]` parece quantidade (inteiro pequeno ou decimal sem padrão monetário, ex: `10`), aplicar shift de `-1` a todos os índices numéricos da direita (`qtyIdx`, `unitarioIdx`, `totalIdx`).

3. Guardar esse shift detectado e aplicá-lo às demais linhas de item da mesma seção/cliente.

4. **Fallback de segurança**: caso a detecção de shift seja inconclusiva (poucas linhas, valores ambíguos), aplicar shift `-1` por padrão para arquivos que correspondam ao padrão "Vendas Detalhadas" (cabeçalho na linha que começa com `Código;;;Descrição`), já que esse layout é o do exportador ADV atual.

5. **Não alterar** o caminho primário (`parseVendasCSV` com índices fixos) — continua intacto para compatibilidade com formatos antigos.

## Resultado

- Quantidade passa a ser lida corretamente da coluna **M (índice 12)**
- Preço unitário e total continuam corretos
- Romaneio de carga reflete as quantidades reais do pedido
- Formato antigo (que já funcionava) continua funcionando sem mudança

## Arquivo

- `src/lib/advParser.ts` — ajustar `parseVendasCSVDynamic` para detectar e compensar o desalinhamento de 1 coluna entre cabeçalho e dados nos campos numéricos da direita

