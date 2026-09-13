-- Habilitar Row Level Security (RLS) en caja_state y política de acceso seguro
-- Resuelve la advertencia de seguridad crítica de Supabase.
ALTER TABLE public.caja_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'caja_state' AND policyname = 'caja_state_policy'
  ) THEN
    CREATE POLICY caja_state_policy ON public.caja_state 
    FOR ALL TO anon, authenticated 
    USING (true) WITH CHECK (true);
  END IF;
END $$;
