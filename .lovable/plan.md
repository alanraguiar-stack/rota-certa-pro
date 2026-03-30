

# Plano: Redesign das Cidades Secundárias + Remover Prioridade

## Mudanças

### 1. Layout de Cidades Secundárias — estilo lista vertical com checkboxes grandes

Inspirado no print (lista vertical, checkbox à esquerda, texto grande, espaçamento generoso), substituir o layout atual de `flex-wrap` horizontal por uma lista vertical dentro de um container com scroll:

```text
ANTES:                          DEPOIS:
☑ Barueri ☑ Cotia ☐ Jandira    ┌─────────────────────┐
☐ Itapevi ☑ Embu               │ ☑  Barueri           │
                                │ ☐  Cotia             │
                                │ ☑  Jandira           │
                                │ ☐  Itapevi           │
                                │ ☑  Embu              │
                                └─────────────────────┘
```

- Container com `border rounded-lg` e `max-h-[280px] overflow-y-auto`
- Cada item: `flex items-center gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/50`
- Checkbox maior (`h-5 w-5`) com label `text-base font-medium`
- Remover os badges duplicados abaixo (redundantes com os checkboxes)

### 2. Remover campo de Prioridade

Remover linhas 251-262 (input de prioridade) do card. Manter o valor internamente (default baseado no índice) para não quebrar a lógica do motor.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/settings/TruckTerritoryTab.tsx` | Redesign lista vertical + remover prioridade UI |

