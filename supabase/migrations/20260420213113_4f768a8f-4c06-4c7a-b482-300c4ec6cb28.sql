
-- trucks
CREATE POLICY "Admins can view all trucks" ON public.trucks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert trucks" ON public.trucks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all trucks" ON public.trucks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all trucks" ON public.trucks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- truck_territories
CREATE POLICY "Admins can view all truck_territories" ON public.truck_territories FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert truck_territories" ON public.truck_territories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all truck_territories" ON public.truck_territories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all truck_territories" ON public.truck_territories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- territory_overrides
CREATE POLICY "Admins can view all territory_overrides" ON public.territory_overrides FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert territory_overrides" ON public.territory_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all territory_overrides" ON public.territory_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all territory_overrides" ON public.territory_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- city_delivery_schedule
CREATE POLICY "Admins can view all city_delivery_schedule" ON public.city_delivery_schedule FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert city_delivery_schedule" ON public.city_delivery_schedule FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all city_delivery_schedule" ON public.city_delivery_schedule FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all city_delivery_schedule" ON public.city_delivery_schedule FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- product_units
CREATE POLICY "Admins can view all product_units" ON public.product_units FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert product_units" ON public.product_units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all product_units" ON public.product_units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all product_units" ON public.product_units FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- route_history_patterns
CREATE POLICY "Admins can view all route_history_patterns" ON public.route_history_patterns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert route_history_patterns" ON public.route_history_patterns FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all route_history_patterns" ON public.route_history_patterns FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- app_settings
CREATE POLICY "Admins can view all app_settings" ON public.app_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert app_settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all app_settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all app_settings" ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
