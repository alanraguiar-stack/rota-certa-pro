-- Create order_items table to support multiple items per order
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  weight_kg NUMERIC NOT NULL CHECK (weight_kg > 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies: access through parent order
CREATE POLICY "Users can view order_items of their routes"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN routes r ON r.id = o.route_id
      WHERE o.id = order_items.order_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order_items to their routes"
  ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN routes r ON r.id = o.route_id
      WHERE o.id = order_items.order_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update order_items of their routes"
  ON public.order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN routes r ON r.id = o.route_id
      WHERE o.id = order_items.order_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete order_items of their routes"
  ON public.order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN routes r ON r.id = o.route_id
      WHERE o.id = order_items.order_id AND r.user_id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_name ON public.order_items(product_name);

-- Add comment for documentation
COMMENT ON TABLE public.order_items IS 'Stores individual items for each order, allowing multiple products per delivery';