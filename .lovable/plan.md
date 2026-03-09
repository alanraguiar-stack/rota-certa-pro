

# Remodelagem do Sistema de Âncoras e Sequenciamento

## Contexto

O sistema atual vincula caminhões âncora a placas fixas (EUR→Barueri, CYR→Osasco, etc.). O usuário quer que o sistema atribua automaticamente qualquer caminhão disponível como âncora de cada cidade, e adiciona novas regras de território e sequenciamento.

## 1. Novo modelo de âncoras por CIDADE (não por placa)

**Arquivo:** `src/lib/anchorRules.ts`

Substituir o modelo plate-based por city-based. Em vez de `platePrefix`, cada regra define apenas a cidade âncora e suas regras. O motor seleciona automaticamente qual caminhão da frota será o âncora.

**Novas regras de território:**

| Âncora | Cidade principal | Sequência | Fill / Exceções |
|--------|-----------------|-----------|-----------------|
| Barueri | barueri | Barueri primeiro | Cotia, Vargem Grande Paulista (SEM Jandira/Itapevi — vão para âncora própria). Excluir bairro Jardim Mutinga (vai para Osasco) |
| Osasco | osasco | Jardim Mutinga (Barueri) PRIMEIRO, depois Osasco | Exceções: Jaguaré, Parque Imperial (SP, máx 2) |
| Carapicuíba | carapicuiba | Carapicuíba primeiro | Exceções mantidas (Metalúrgicos/Osasco, Vila do Conde/Barueri) |
| Jandira | jandira | Jandira PRIMEIRO, depois Itapevi | Fill: itapevi |
| Embu | embu | Embu PRIMEIRO | Fill bairros: Conceição, Metalúrgico, Santa Maria (Osasco) + Vila da Oportunidade, Jardim Yaya, Pousada dos Bandeirantes (Carapicuíba) |
| Apoio | (sem âncora) | — | Pirapora, Santana de Parnaíba, Taboão, SP + excedentes |

**Seleção automática de caminhão:** O motor percorre a frota disponível e atribui cada regra ao caminhão com melhor capacidade disponível que ainda não foi atribuído a outra regra. Prioridade: caminhões com `max_deliveries >= 25` e maior `capacity_kg`.

## 2. Motor de alocação (`src/lib/autoRouterEngine.ts`)

**Mudanças:**
- Step 3: Em vez de `findAnchorRule(plate)`, iterar sobre `TERRITORY_RULES` e atribuir cada regra a um caminhão disponível automaticamente
- Step 4: Lógica de alocação mantida, mas adaptada para o novo modelo
- Barueri: excluir pedidos do bairro Jardim Mutinga (reservados para Osasco)
- Osasco: buscar pedidos de Jardim Mutinga (Barueri) e colocá-los primeiro
- Embu: buscar pedidos por bairro específico de Osasco e Carapicuíba (não cidade inteira)

## 3. Sequenciamento com agrupamento por rua (`optimizeDeliverySequence`)

**Arquivo:** `src/lib/autoRouterEngine.ts`

Reforçar o `sortWithinCity` para garantir que endereços na mesma rua fiquem consecutivos. A função atual já ordena por CEP > bairro > rua, o que agrupa ruas naturalmente. Vou adicionar um passo extra de "sweep" que, após o sort inicial, verifica se há endereços da mesma rua separados e os reagrupa.

**Regras de sequência por âncora:**
- Jandira: Jandira primeiro, depois Itapevi
- Embu: Embu primeiro, depois bairros de fill
- Osasco: Jardim Mutinga (Barueri) primeiro, depois Osasco
- Barueri: Barueri primeiro (exceto Jardim Mutinga), depois fills

## 4. Atualização da validação

Adaptar `validateComposition` para o novo modelo territory-based em vez de plate-based.

## 5. Interface `findAnchorRule`

Manter a função pública mas internamente usar o novo modelo. Componentes que chamam `findAnchorRule(plate)` continuarão funcionando — a função retornará a regra do território atribuído àquele caminhão durante a composição.

## Resumo de Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/anchorRules.ts` | Novo modelo territory-based, 6 regras, seleção automática de caminhão |
| `src/lib/autoRouterEngine.ts` | Motor adaptado para territórios, alocação por bairro, sequenciamento com agrupamento por rua, regras de sequência por âncora |

