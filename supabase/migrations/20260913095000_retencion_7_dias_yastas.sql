-- Política de Retención de 7 Días para Encuadre Yastás
-- Borra automáticamente movimientos, jobs y ajustes con más de 7 días de antigüedad
CREATE OR REPLACE FUNCTION public.purgar_yastas_antiguos()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.yastas_movimientos_portal WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM public.yastas_import_jobs WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM public.yastas_encuadre_ajustes WHERE fecha < CURRENT_DATE - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_purgar_yastas ON public.yastas_import_jobs;
CREATE TRIGGER trigger_purgar_yastas
AFTER INSERT OR UPDATE ON public.yastas_import_jobs
FOR EACH STATEMENT
EXECUTE FUNCTION public.purgar_yastas_antiguos();
