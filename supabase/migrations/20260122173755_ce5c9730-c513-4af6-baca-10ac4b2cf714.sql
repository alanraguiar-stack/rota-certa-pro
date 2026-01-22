-- Add departure time and scheduling columns to route_trucks
ALTER TABLE public.route_trucks
ADD COLUMN IF NOT EXISTS departure_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS departure_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_last_delivery_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS estimated_return_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_time_minutes INTEGER DEFAULT 5;

-- Add default delivery time setting to profiles table for admin configuration
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS default_delivery_time_minutes INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS return_to_cd_required BOOLEAN DEFAULT true;

-- Create a settings table for global configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for app_settings
CREATE POLICY "Users can view their own settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.app_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" 
ON public.app_settings 
FOR DELETE 
USING (auth.uid() = user_id);