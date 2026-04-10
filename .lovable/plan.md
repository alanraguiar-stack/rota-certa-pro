

# Corrigir Romaneio de Carga para formato correto

## Problema
O PDF gerado atualmente usa 4 colunas (#, Descrição, UN, Qtde) e layout incorreto. O modelo correto tem 3 colunas (#, Produto, Peso Total) com quantidade e unidade combinadas numa coluna só (ex: "3 fardos", "1.0kg", "2 caixas").

## Diferenças entre o atual e o modelo correto

| Elemento | Atual (errado) | Modelo (correto) |
|---|---|---|
| Título | "Romaneio" | "ROMANEIO DE CARGA" |
| Cabeçalho | Linha única com todos dados | Box com VEICULO/DATA/CARGA TOTAL/CAPACIDADE |
| Seção | Nenhuma | "PRODUTOS PARA SEPARACAO" |
| Tabela | 4 colunas (#, Descrição, UN, Qtde) | 3 colunas (#, Produto, Peso Total) |
| Qtde | Número separado da unidade | Combinado: "3 fardos", "120.0kg" |
| Total | Sem linha de total | Linha "TOTAL" com peso total |
| Conferência | 1 assinatura | "CONFERENCIA DE CARGA" + Separador + Conferente |
| Data | "Data: ___/___/___" | "Data da conferencia: ___/___/______ Hora: ___:___" |
| Footer | Com timestamp | "Gerado por Rota Certa" |
| Clientes | Lista no cabeçalho | Sem lista de clientes |

## Mudanças em `src/components/route/LoadingManifest.tsx`

### 1. Nova função `formatQtyWithUnit`
Combinar quantidade + nome da unidade por extenso:
- `3` + `fardo` → `"3 fardos"`
- `120.0` + `kg` → `"120.0kg"`
- `1` + `caixa` → `"1 caixa"`
- Incluir plural automático (fardo/fardos, caixa/caixas, etc.)

### 2. Refazer `generateLoadingManifestPDF`
Seguir exatamente o layout do modelo:
- Título "ROMANEIO DE CARGA" grande e centralizado
- Número da rota abaixo
- Box com VEICULO / DATA / CARGA TOTAL / CAPACIDADE usando `autoTable` com 2 linhas
- Subtítulo "PRODUTOS PARA SEPARACAO"
- Tabela de 3 colunas: #, Produto, Peso Total (alinhado à direita)
- Linha de TOTAL no final da tabela
- Seção "CONFERENCIA DE CARGA" com Separador e Conferente lado a lado
- Box "Data da conferencia: ___/___/______ Hora: ___:___"
- Footer "Gerado por Rota Certa"

### 3. Atualizar preview HTML (tela)
Alinhar a pré-visualização na tela ao mesmo formato do PDF para consistência visual.

## Arquivo
- `src/components/route/LoadingManifest.tsx` — refatorar PDF e preview

