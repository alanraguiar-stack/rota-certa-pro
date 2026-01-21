-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trucks table for fleet management
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity_kg DECIMAL(10,2) NOT NULL CHECK (capacity_kg > 0),
  max_deliveries INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routes table for route planning sessions
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'planned', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table for delivery orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL CHECK (weight_kg > 0),
  sequence_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_trucks junction table for trucks assigned to routes
CREATE TABLE public.route_trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  total_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  estimated_distance_km DECIMAL(10,2),
  estimated_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(route_id, truck_id)
);

-- Create order_assignments table to assign orders to trucks
CREATE TABLE public.order_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  route_truck_id UUID NOT NULL REFERENCES public.route_trucks(id) ON DELETE CASCADE,
  delivery_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trucks
CREATE POLICY "Users can view their own trucks"
  ON public.trucks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trucks"
  ON public.trucks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trucks"
  ON public.trucks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trucks"
  ON public.trucks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for routes
CREATE POLICY "Users can view their own routes"
  ON public.routes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routes"
  ON public.routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes"
  ON public.routes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routes"
  ON public.routes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for orders (access via route ownership)
CREATE POLICY "Users can view orders of their routes"
  ON public.orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = orders.route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert orders to their routes"
  ON public.orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can update orders of their routes"
  ON public.orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = orders.route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete orders of their routes"
  ON public.orders FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = orders.route_id 
    AND routes.user_id = auth.uid()
  ));

-- RLS Policies for route_trucks (access via route ownership)
CREATE POLICY "Users can view route_trucks of their routes"
  ON public.route_trucks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = route_trucks.route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert route_trucks to their routes"
  ON public.route_trucks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can update route_trucks of their routes"
  ON public.route_trucks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = route_trucks.route_id 
    AND routes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete route_trucks of their routes"
  ON public.route_trucks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.routes 
    WHERE routes.id = route_trucks.route_id 
    AND routes.user_id = auth.uid()
  ));

-- RLS Policies for order_assignments (access via route ownership)
CREATE POLICY "Users can view order_assignments of their routes"
  ON public.order_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = order_assignments.route_truck_id 
    AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert order_assignments to their routes"
  ON public.order_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = route_truck_id 
    AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can update order_assignments of their routes"
  ON public.order_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = order_assignments.route_truck_id 
    AND r.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete order_assignments of their routes"
  ON public.order_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.route_trucks rt
    JOIN public.routes r ON r.id = rt.route_id
    WHERE rt.id = order_assignments.route_truck_id 
    AND r.user_id = auth.uid()
  ));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trucks_updated_at
  BEFORE UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();