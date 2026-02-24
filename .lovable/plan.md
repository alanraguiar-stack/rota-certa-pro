
# Regras Operacionais Fixas — Caminhões Âncora

## Status: ✅ Implementado

## Lógica Implementada

O sistema usa caminhões âncora fixos por território (placa → cidade):

| Placa | Cidade Âncora | Máx Entregas | Encaixe Permitido |
|-------|---------------|--------------|-------------------|
| EUR   | Barueri       | 22           | Jandira, Itapevi, Cotia, Vargem Grande Paulista |
| CYR   | Osasco        | 24           | Bairros: Jaguaré (2), Parque Imperial (2) |
| FKD   | Carapicuíba   | 24           | Bairros: Metalúrgicos (após Jd Novo Horizonte), Vila do Conde (2) |
| EEF   | Apoio         | —            | Pirapora, Santana de Parnaíba, Taboão, Embu, São Paulo + excedentes |

## Arquivos

| Arquivo | Função |
|---------|--------|
| `src/lib/anchorRules.ts` | Regras fixas dos caminhões âncora |
| `src/lib/autoRouterEngine.ts` | Motor de roteirização baseado em regras |
| `src/components/route/AutoCompositionView.tsx` | UI com feedback de âncora e violações |

## Validações

- Limite de entregas por caminhão
- Limite de peso
- Cidade âncora obrigatória
- Cidades não autorizadas bloqueadas
- Alternância de cidades na sequência proibida
