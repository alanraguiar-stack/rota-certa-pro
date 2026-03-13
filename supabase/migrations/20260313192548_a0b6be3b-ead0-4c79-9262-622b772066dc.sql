-- Drivers can view orders assigned to them via delivery_executions
CREATE POLICY "Drivers can view assigned orders"
  ON public.orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.delivery_executions de
    JOIN public.driver_assignments da ON da.id = de.driver_assignment_id
    WHERE de.order_id = orders.id
    AND da.driver_user_id = auth.uid()
  ));

-- Drivers can view order_assignments for their assigned routes
CREATE POLICY "Drivers can view order_assignments"
  ON public.order_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    WHERE da.route_truck_id = order_assignments.route_truck_id
    AND da.driver_user_id = auth.uid()
  ));