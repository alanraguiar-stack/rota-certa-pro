
-- 1. Add 'motorista' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'motorista';

-- 2. Create driver_assignments table
CREATE TABLE public.driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_truck_id uuid NOT NULL REFERENCES public.route_trucks(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(route_truck_id)
);

ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own assignments
CREATE POLICY "Drivers can view own assignments"
  ON public.driver_assignments FOR SELECT
  USING (auth.uid() = driver_user_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON public.driver_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert assignments
CREATE POLICY "Admins can insert assignments"
  ON public.driver_assignments FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update assignments
CREATE POLICY "Admins can update assignments"
  ON public.driver_assignments FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Drivers can update their own assignments (status changes)
CREATE POLICY "Drivers can update own assignments"
  ON public.driver_assignments FOR UPDATE
  USING (auth.uid() = driver_user_id);

-- Admins can delete assignments
CREATE POLICY "Admins can delete assignments"
  ON public.driver_assignments FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Route owners can view assignments for their routes
CREATE POLICY "Route owners can view assignments"
  ON public.driver_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = driver_assignments.route_truck_id
    AND r.user_id = auth.uid()
  ));

-- Route owners can insert assignments
CREATE POLICY "Route owners can insert assignments"
  ON public.driver_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = route_truck_id
    AND r.user_id = auth.uid()
  ));

-- Route owners can update assignments
CREATE POLICY "Route owners can update assignments"
  ON public.driver_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = driver_assignments.route_truck_id
    AND r.user_id = auth.uid()
  ));

-- Route owners can delete assignments
CREATE POLICY "Route owners can delete assignments"
  ON public.driver_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = driver_assignments.route_truck_id
    AND r.user_id = auth.uid()
  ));

-- 3. Create delivery_executions table
CREATE TABLE public.delivery_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_assignment_id uuid NOT NULL REFERENCES public.driver_assignments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  delivered_at timestamp with time zone,
  signature_url text,
  photo_url text,
  observations text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_assignment_id, order_id)
);

ALTER TABLE public.delivery_executions ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own delivery executions
CREATE POLICY "Drivers can view own executions"
  ON public.delivery_executions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    WHERE da.id = delivery_executions.driver_assignment_id
    AND da.driver_user_id = auth.uid()
  ));

-- Drivers can update their own delivery executions
CREATE POLICY "Drivers can update own executions"
  ON public.delivery_executions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    WHERE da.id = delivery_executions.driver_assignment_id
    AND da.driver_user_id = auth.uid()
  ));

-- Admins can view all executions
CREATE POLICY "Admins can view all executions"
  ON public.delivery_executions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all executions
CREATE POLICY "Admins can insert executions"
  ON public.delivery_executions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update executions"
  ON public.delivery_executions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Route owners can view executions
CREATE POLICY "Route owners can view executions"
  ON public.delivery_executions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    JOIN public.route_trucks rt ON rt.id = da.route_truck_id
    JOIN public.routes r ON r.id = rt.route_id
    WHERE da.id = delivery_executions.driver_assignment_id
    AND r.user_id = auth.uid()
  ));

-- Route owners can insert executions
CREATE POLICY "Route owners can insert executions"
  ON public.delivery_executions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.driver_assignments da
    JOIN public.route_trucks rt ON rt.id = da.route_truck_id
    JOIN public.routes r ON r.id = rt.route_id
    WHERE da.id = driver_assignment_id
    AND r.user_id = auth.uid()
  ));

-- 4. Create storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true);

-- Storage policies: authenticated users can read
CREATE POLICY "Authenticated users can view delivery proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

-- Drivers can upload to their own folder
CREATE POLICY "Users can upload delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

-- Users can update their own uploads
CREATE POLICY "Users can update own delivery proofs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);
