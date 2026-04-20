

# Compartilhar frota e configurações entre admins

## Causa raiz

Todas as tabelas de configuração operacional (`trucks`, `truck_territories`, `territory_overrides`, `city_delivery_schedule`, `product_units`, `route_history_patterns`, `app_settings`) têm RLS estrita por `auth.uid() = user_id`. Como Alan cadastrou 11 caminhões + 423 produtos sob o `user_id` dele, a Caroline (que também é admin) não enxerga nada — vê só o 1 caminhão que ela mesma cadastrou.

A operação é uma só (mesma frota, mesmos territórios, mesmo calendário), então admins precisam compartilhar essas configurações.

## Solução: políticas RLS expandidas para admins

Para cada tabela de configuração, adicionar políticas que permitem **qualquer admin** ler/editar/criar/deletar registros — independente de quem foi o `user_id` original. As políticas atuais (dono próprio) continuam, então usuários `operacional` continuam vendo só os dados deles.

### Tabelas afetadas
- `trucks` — frota compartilhada
- `truck_territories` — territórios da frota
- `territory_overrides` — overrides de cidades
- `city_delivery_schedule` — calendário de entregas
- `product_units` — catálogo de produtos aprendidos
- `route_history_patterns` — histórico de aprendizado
- `app_settings` — configurações gerais

### Política a adicionar em cada tabela
```sql
-- Exemplo para trucks (replicado nas demais)
CREATE POLICY "Admins can view all trucks"
  ON trucks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert trucks"
  ON trucks FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update trucks"
  ON trucks FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete trucks"
  ON trucks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

## Ajuste no código

`src/hooks/useTrucks.ts` — a query atual usa `queryKey: ['trucks', user?.id]`, o que é seguro mas faz o cache trocar por usuário (ok). Nenhuma mudança de código necessária — assim que a RLS for liberada, a Caroline passará a ver os 11 caminhões automaticamente. Mesmo vale para `useTruckTerritories`, `useCitySchedule`, `useProductUnits`, `useHistoryPatterns`.

## Resultado

- Caroline (e qualquer futuro admin) passa a ver toda a frota, territórios, calendário, produtos aprendidos e histórico
- Usuários `operacional` continuam restritos aos próprios dados (políticas atuais preservadas)
- Motoristas continuam isolados pelas políticas específicas deles

## Arquivos

- Migração SQL — adicionar políticas de admin nas 7 tabelas de configuração

