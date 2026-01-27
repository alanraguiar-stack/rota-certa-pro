
# Plano: Corrigir Seletor de Estratégia e Romaneio de Carga

## Problemas Identificados

### Problema 1: Seletor de Estratégia Aparecendo na Etapa Errada
O componente `RoutingStrategySelector` (com todas as opções de escolha) está sendo exibido na etapa de Romaneio de Carga, mesmo que o usuário já tenha selecionado a estratégia na fase anterior do wizard.

**Causa:** No arquivo `RouteDetails.tsx` (linhas 658-661), o seletor completo está sempre sendo renderizado na etapa `loading_manifest`.

### Problema 2: Romaneio de Carga Vazio
Os dados de `order_items` estão todos vazios (`nil`) no banco de dados para esta rota.

**Causa:** A rota foi criada ANTES das correções de persistência de itens. O código atual que salva os itens (useRoutes.ts linhas 266-280) só funciona para NOVAS rotas criadas após a correção.

## Solução

### Parte 1: Remover Seletor de Estratégia da Etapa de Romaneio

Substituir o `RoutingStrategySelector` completo por um resumo simples da estratégia já selecionada. A estratégia já vem definida do wizard (`location.state.routingStrategy`).

### Parte 2: Usar Peso Total do Pedido como Fallback

Quando não houver `order_items` detalhados, o romaneio de carga deve consolidar os pesos usando o peso total de cada pedido (`weight_kg`), agrupando por caminhão. Não ficará vazio.

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/RouteDetails.tsx` | Editar | Remover seletor de estratégia, mostrar apenas resumo |
| `src/components/route/LoadingManifest.tsx` | Editar | Melhorar fallback para exibir peso total quando não houver itens detalhados |

## Mudanças Técnicas

### 1. RouteDetails.tsx (linhas 647-674)

Substituir o bloco de seleção de estratégia por um resumo:

```typescript
// ANTES (linha 647-674)
<Card className="border-primary/50 bg-primary/5">
  <CardContent className="py-6">
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <p className="font-medium text-lg">Pronto para roteirizar?</p>
        <p className="text-sm text-muted-foreground">
          Defina a estratégia e gere o Romaneio de Entrega com a ordem otimizada.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full sm:w-auto">
        <RoutingStrategySelector
          selectedStrategy={routingStrategy}
          onStrategyChange={setRoutingStrategy}
        />
        <Button ...>Roteirizar Agora</Button>
      </div>
    </div>
  </CardContent>
</Card>

// DEPOIS
<Card className="border-primary/50 bg-primary/5">
  <CardContent className="py-6">
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <RouteIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-lg">Pronto para roteirizar</p>
          <p className="text-sm text-muted-foreground">
            Estratégia: <strong>{getStrategyLabel(routingStrategy)}</strong>
          </p>
        </div>
      </div>
      <Button 
        size="lg"
        onClick={handleOptimizeRoutes}
        disabled={optimizeRoutes.isPending}
      >
        <RouteIcon className="mr-2 h-4 w-4" />
        {optimizeRoutes.isPending ? 'Otimizando rotas...' : 'Roteirizar Agora'}
      </Button>
    </div>
  </CardContent>
</Card>
```

Adicionar função helper:

```typescript
function getStrategyLabel(strategy: RoutingStrategy): string {
  const labels: Record<RoutingStrategy, string> = {
    economy: 'Economia (menor distância)',
    speed: 'Velocidade (menor tempo)',
    end_near_cd: 'Finalizar no CD',
    start_far: 'Longe → Perto',
    start_near: 'Perto → Longe',
  };
  return labels[strategy] || strategy;
}
```

### 2. LoadingManifest.tsx - Melhorar Fallback

Quando não houver `order_items`, mostrar lista de clientes com peso total em vez de "Produto não especificado":

```typescript
// Em consolidateProducts(), melhorar fallback (linhas 46-54)
} else {
  // Fallback: usar client_name + peso total do pedido
  const label = order.product_description || `Pedido ${order.client_name}`;
  const existing = productMap.get(label) || { weight: 0, count: 0 };
  productMap.set(label, {
    weight: existing.weight + Number(order.weight_kg),
    count: existing.count + 1,
  });
}
```

## Fluxo Visual Corrigido

Antes:

```text
[Romaneio de Carga] 
    └── Seletor de Estratégia (COMPLETO) ← Usuário já escolheu antes
    └── Botão Roteirizar
```

Depois:

```text
[Romaneio de Carga]
    └── Resumo: "Estratégia: Economia" ← Apenas informativo
    └── Botão Roteirizar
```

## Resultado Esperado

1. O seletor de estratégia NÃO aparece mais na etapa de romaneio
2. Apenas um resumo da estratégia selecionada é exibido
3. O romaneio de carga mostra lista de pedidos por caminhão com pesos totais
4. Para novas rotas com itens detalhados, o romaneio consolidará por produto
5. Para rotas antigas sem itens, o romaneio mostrará lista de clientes/pedidos com pesos
