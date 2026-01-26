

# Plano: Duas Áreas de Colagem Manual (Igual ao Upload de Planilhas)

## Objetivo

Modificar a aba **Manual** para ter **dois espaços de colagem** lado a lado, espelhando o design da aba **Automático** que possui duas áreas de upload.

## Layout Proposto

```text
┌─────────────────────────────────────┐
│  Instruções de Cruzamento           │
└─────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐
│ 1. Itinerário   │  │ 2. Relatório    │
│ (Endereços)     │  │ (Itens/ADV)     │
│                 │  │                 │
│ [Colar]         │  │ [Colar]         │
│ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │ Textarea    │ │  │ │ Textarea    │ │
│ │             │ │  │ │             │ │
│ └─────────────┘ │  │ └─────────────┘ │
│                 │  │                 │
│ ✓ 45 endereços  │  │ ✓ 45 pedidos    │
└─────────────────┘  └─────────────────┘

┌─────────────────────────────────────┐
│  Resumo: 43 cruzados, 2 sem match   │
└─────────────────────────────────────┘

        [Importar 43 Pedidos]
```

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/route/OrdersInput.tsx` | Refatorar componente `PasteData` para `DualPasteData` |

## Mudanças Técnicas

### 1. Novo Componente: `DualPasteData`

Substituir o `PasteData` atual por um componente com duas áreas:

```typescript
interface PasteAreaState {
  text: string;
  status: 'idle' | 'parsing' | 'success' | 'error';
  message: string;
  data: any;
  detectedType?: 'itinerario' | 'adv' | 'generic';
}

function DualPasteData({ onParsed }: { onParsed: (result: ParseResult) => void }) {
  const [area1, setArea1] = useState<PasteAreaState>({ ... });
  const [area2, setArea2] = useState<PasteAreaState>({ ... });
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  
  // ...
}
```

### 2. Detecção Automática de Formato

Ao colar dados em qualquer área, o sistema detectará automaticamente o tipo:

- **Itinerário**: Detectado por colunas "End. Ent.", "Bairro Ent.", "Cep Ent."
- **ADV/Itens**: Detectado por estrutura hierárquica ou colunas de itens
- **Genérico**: Formato padrão com Cliente, Endereço, Peso

```typescript
function detectPastedDataType(text: string): 'itinerario' | 'adv' | 'generic' {
  const lowerText = text.toLowerCase();
  if (/end\.?\s*ent|bairro\.?\s*ent|cep\.?\s*ent/i.test(lowerText)) {
    return 'itinerario';
  }
  if (/vendas\s*detalhadas|cliente:|qtd\.?\s*ped/i.test(lowerText)) {
    return 'adv';
  }
  return 'generic';
}
```

### 3. Cruzamento de Dados Colados

Quando ambas as áreas tiverem dados válidos, o sistema cruzará pelo número da venda:

```typescript
const tryMergeData = () => {
  if (area1.status === 'success' && area2.status === 'success') {
    // Identificar qual é itinerário e qual é ADV
    // Cruzar usando mergeItinerarioWithADV()
    // Atualizar mergeSummary
  }
};
```

### 4. Layout Responsivo

- Em desktop: Duas colunas lado a lado (grid md:grid-cols-2)
- Em mobile: Uma coluna empilhada

### 5. Estados Visuais

Cada área mostrará:
- **Idle**: Ícone de colagem + instrução
- **Processando**: Spinner
- **Sucesso**: Check verde + contagem de itens
- **Erro**: X vermelho + mensagem de erro

## Fluxo de Uso

1. Usuário cola dados do Itinerário (Excel) na área 1
2. Sistema detecta como "itinerário" e extrai endereços
3. Usuário cola dados do ADV na área 2
4. Sistema detecta como "ADV" e extrai itens
5. Sistema cruza automaticamente pelo número da venda
6. Exibe resumo: "43 pedidos completos, 2 sem endereço"
7. Botão "Importar 43 Pedidos" fica disponível

## Casos de Uso

| Cenário | Comportamento |
|---------|---------------|
| Só área 1 preenchida (itinerário) | Permite importar sem itens detalhados |
| Só área 2 preenchida (ADV) | Alerta que faltam endereços |
| Ambas preenchidas | Cruza e mostra resumo |
| Formato genérico em qualquer área | Processa normalmente |

## Passos de Implementação

1. **Criar estado para duas áreas** no componente PasteData
2. **Adicionar função de detecção de tipo** para dados colados
3. **Implementar grid com duas áreas** de textarea
4. **Reutilizar lógica de cruzamento** de `DualFileUpload`
5. **Exibir resumo do cruzamento** abaixo das áreas
6. **Botão de importar** mostra contagem correta

## Resultado Esperado

1. Aba Manual mostra duas áreas de colagem lado a lado
2. Usuário cola dados em qualquer ordem
3. Sistema detecta automaticamente o tipo de cada área
4. Dados são cruzados pelo número da venda
5. Resumo mostra quantos pedidos foram cruzados com sucesso
6. Importação inclui endereço + itens quando disponíveis

