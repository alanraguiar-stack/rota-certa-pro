-- Fix 1: Add DELETE policy for delivery-proofs storage bucket
CREATE POLICY "Owners can delete own proofs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'delivery-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix 2: Remove delivery_executions from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'delivery_executions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_executions;
  END IF;
END $$;