-- Intentos de operación abandonados tras escribir mal el PIN.
-- Solo se guarda una fila cuando alguien falla el PIN y cierra la ventana sin completar la operación.
-- Tabla aparte: no toca caja_logs, la bitácora, los saldos ni el cierre. Solo la lee el encuadre Yastás.
CREATE TABLE IF NOT EXISTS public.caja_pin_fallidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_en timestamptz NOT NULL DEFAULT now(),
  fecha date NOT NULL,          -- fecha local del equipo
  hora text NOT NULL,           -- HH:MM:SS local, del último intento fallido
  servicio text,
  tipo text,
  montos numeric[] NOT NULL DEFAULT '{}',  -- montos posibles de la operación (total, depósito, retiro...)
  intentos int NOT NULL DEFAULT 1,
  titulo text
);
CREATE INDEX IF NOT EXISTS caja_pin_fallidos_fecha_idx ON public.caja_pin_fallidos (fecha);

ALTER TABLE public.caja_pin_fallidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pin_fallidos_insert ON public.caja_pin_fallidos;
CREATE POLICY pin_fallidos_insert ON public.caja_pin_fallidos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS pin_fallidos_select ON public.caja_pin_fallidos;
CREATE POLICY pin_fallidos_select ON public.caja_pin_fallidos FOR SELECT TO anon, authenticated USING (true);

-- Retención de 7 días, igual que el resto del encuadre Yastás.
CREATE OR REPLACE FUNCTION public.purgar_yastas_antiguos()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.yastas_movimientos_portal WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM public.yastas_import_jobs WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM public.yastas_encuadre_ajustes WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM public.caja_pin_fallidos WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
