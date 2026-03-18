
Diagnóstico (pente fino)
- Sim, eu sei exatamente o problema.
- Evidências encontradas:
  1) Console: `"[distributeLoad] Using pre-computed autoResult from wizard"` (fluxo antigo ainda em execução no runtime).
  2) Logs do banco: erro `invalid input syntax for type uuid: "280007"` ao inserir em `order_assignments`.
  3) Estado inconsistente da rota `533e...`: `route_trucks.total_orders` preenchido (13/14/16), porém `order_assignments` = 0.
- Conclusão: a otimização de “reusar resultado pré-computado do wizard” afetou a distribuição. IDs de pedido temporários/não-UUID foram usados no insert, o insert falhou, mas o fluxo continuou atualizando totais/status (falso sucesso).

Plano de correção (implementação)
1) Blindar `distributeLoadMutation` contra falso sucesso (arquivo: `src/hooks/useRoutes.ts`)
- Garantir que a distribuição sempre use pedidos reais já persistidos (UUID válidos).
- Remover definitivamente qualquer branch de precomputed no caminho de persistência.
- Validar `order_id` antes do insert (UUID). Se inválido, abortar com erro claro.
- Checar erro de TODAS as operações (delete/insert/update/status). Hoje há chamadas sem `if (error) throw`.
- Só atualizar `route_trucks.total_*` e `routes.status` após insert de assignments confirmado.
- Fazer delete antigo em uma única query (`.in('route_truck_id', ids)`) para reduzir round-trips.

2) Recuperação automática de inconsistência no fluxo (arquivo: `src/pages/RouteDetails.tsx`)
- Adicionar detecção: `status` avançado (`loading`/`distributed`) + `assignments` vazios + `total_orders` em caminhões > 0.
- Exibir card de recuperação com ação “Reprocessar distribuição”.
- Ao recuperar: limpar totais inconsistentes, voltar para etapa correta e reexecutar distribuição.

3) Evitar regressão de runtime antigo
- Confirmar que não há mais referência a `preComputedAutoResult`/`using pre-computed` no código final.
- Forçar caminho único de distribuição (source of truth = dados persistidos da rota).

4) Performance (pedido de “sistema mais rápido”)
- Curto prazo (neste mesmo ajuste):
  - delete único por `in(...)`;
  - insert único em lote;
  - updates de caminhão em paralelo com checagem de erro.
- Próximo passo recomendado (opcional, ganho maior):
  - mover persistência da distribuição para uma função de backend transacional (um único round-trip + atomicidade).

Validação ponta a ponta (E2E)
1) Criar rota via wizard com arquivo que tenha `pedido_id` textual/numérico (como “280007”).
2) Selecionar frota e clicar “Distribuir Cargas”.
3) Verificar:
- `order_assignments` criado (>0) para a rota;
- soma de assignments por caminhão = `route.total_orders` da rota;
- UI mostra entregas por caminhão (não fica “0”).
4) Reabrir a rota e confirmar persistência (sem desaparecer).
5) Testar o fluxo de recuperação em rota quebrada (como a atual) e validar que volta a distribuir corretamente.
6) Medir tempo da ação de distribuição antes/depois (tempo de resposta e número de requests).

Arquivos afetados
- `src/hooks/useRoutes.ts` (correção principal + validações + robustez + micro-otimização)
- `src/pages/RouteDetails.tsx` (detecção/recuperação de inconsistência)
- (Opcional) teste de integração da distribuição para evitar regressão futura
