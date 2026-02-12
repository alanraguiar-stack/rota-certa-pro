

# Corrigir Romaneio de Carga e Botao de Imprimir

## Problema 1: Unidades de Medida nao aplicadas

A tabela `product_units` esta **vazia** (0 registros). O sistema de consolidacao funciona corretamente no codigo, mas sem dados na tabela, todos os produtos caem no fallback padrao (kg).

**Solucao:** Inserir os 364 produtos da planilha `unidade_de_medida.xlsx` diretamente no banco de dados via migracao SQL. Os dados serao inseridos para o usuario atual. As abreviacoes serao traduzidas:

- UN -> unidade
- FD -> fardo
- CX -> caixa
- KG -> kg
- PC -> peca
- SC -> saco
- DP -> display

**Nota importante:** Como a tabela usa `user_id` com RLS, sera necessario criar um mecanismo para popular os dados para o usuario logado. A melhor abordagem e fazer o import automaticamente na primeira vez que o usuario acessa Configuracoes > Produtos, usando o arquivo `src/assets/unidade_de_medida.xlsx` que ja esta no projeto.

**Arquivo:** `src/components/route/ProductUnitsImporter.tsx`

Adicionar um botao "Importar Planilha Padrao" que carrega automaticamente o arquivo embutido `unidade_de_medida.xlsx` e processa igual ao upload manual. Assim o usuario pode popular a tabela com um clique.

Alternativamente, adicionar logica no `useProductUnits.ts` para, ao detectar tabela vazia, oferecer importacao automatica.

---

## Problema 2: Botao Imprimir com erro

**Arquivo:** `src/components/route/LoadingManifest.tsx` (linha 244)

O codigo atual usa:
```
window.open(doc.output('bloburl'), '_blank');
```

Isso falha no ambiente sandbox do iframe. A solucao e usar a tecnica de iframe + blob URL:

```typescript
const handlePrint = () => {
  const doc = generateLoadingManifestPDF(...);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
};
```

Tambem aplicar a mesma correcao no `src/lib/manifest.ts` (funcao `printManifestPDF`, linha ~280) que tem o mesmo problema.

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/route/LoadingManifest.tsx` | Corrigir handlePrint com iframe |
| `src/lib/manifest.ts` | Corrigir printManifestPDF com iframe |
| `src/components/route/ProductUnitsImporter.tsx` | Adicionar botao "Importar Planilha Padrao" usando arquivo embutido |

## Resultado Esperado

1. Ao clicar "Importar Planilha Padrao" em Configuracoes > Produtos, os 364 produtos serao salvos no banco com suas unidades corretas
2. No Romaneio de Carga, itens como Tubaina aparecerao consolidados como "40 fardos" ao inves de "peso em kg"
3. O botao Imprimir funcionara sem erro, abrindo o dialogo de impressao do navegador
