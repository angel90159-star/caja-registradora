-- Encuadre Yastás: conciliación diaria entre el "Reporte de Movimientos" del Portal de
-- Autoservicio de Yastás y la bitácora de la caja (caja_logs).
-- Ver .agents/PLAN_YASTAS_ENCUADRE.md (secciones 5 y 7C).

-- 1) Una fila por operación del reporte del portal.
--    Solo campos indispensables para el encuadre: NUNCA número de cuenta ni referencia.
create table if not exists public.yastas_movimientos_portal (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  hora             time not null,
  id_operacion     text not null unique,          -- idempotencia: reimportar el mismo día no duplica
  tipo_movimiento  text not null,                 -- OPERACIONES FINANCIERAS | RECARGA DE TIEMPO AIRE | COBRO DE CUENTA DE FONDEO | ABONO A INVERSION
  descripcion      text,
  operacion        text,                          -- CASH-IN | CASH-OUT | -
  monto_total      numeric(12,2) not null default 0,   -- lo que MOVIÓ LA TERMINAL (verificado con Saldo Inicial/Disponible)
  monto_operacion  numeric(12,2) not null default 0,   -- lo que pagó/recibió el cliente (recargas: aquí va el $100)
  comision         numeric(12,2) not null default 0,   -- Comisión UF + IVA Comisión (cobrada al cliente en servicios)
  ganancia         numeric(12,4) not null default 0,   -- columna "Ganancia" del portal: se paga mensual, NO mueve la terminal
  servicio         text,
  status           text,                          -- APROBADA | DECLINADA | ...
  emisor           text,
  tipo_cuenta      text,
  es_interno       boolean not null default false,-- fondeo interno / inversión / consulta de saldo: no se cruza
  origen           text not null default 'manual',-- manual (xlsx cargado en la app) | extension
  importado_en     timestamptz not null default now()
);
create index if not exists yastas_movimientos_portal_fecha_idx on public.yastas_movimientos_portal (fecha);

-- 2) Estado de cada importación: qué días ya están cargados y con cuántas filas.
create table if not exists public.yastas_import_jobs (
  job_id          text primary key,
  fecha           date not null,
  estado          text not null default 'iniciado',   -- iniciado | terminado | descarga-completa | importado | abortado
  paso            text,
  detalle         text,
  filas           int,
  origen          text not null default 'manual',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists yastas_import_jobs_fecha_idx on public.yastas_import_jobs (fecha);

-- 3) Ajustes aplicados desde el encuadre. Clave única (fecha, concepto).
--    Comportamiento INCREMENTAL en una segunda ejecución del mismo día: la app calcula
--    (total del día − monto ya aplicado) y registra solo esa diferencia como nuevo
--    AJUSTE_DE_SALDO; aquí `monto` guarda el acumulado. Doble clic o reabrir la ventana
--    nunca duplica; operaciones nuevas después del primer ajuste sí se completan.
create table if not exists public.yastas_encuadre_ajustes (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  concepto      text not null,                 -- ganancia_terminal | (futuro) correccion_captura:<id_operacion>
  monto         numeric(12,2) not null,        -- ACUMULADO aplicado ese día para ese concepto
  veces         int not null default 1,        -- cuántas ejecuciones lo han ido completando
  detalle       text,                          -- desglose de la última ejecución (ej. "Recargas +$7.00")
  operador      text,                          -- quién dio clic la última vez
  log_ids       text[] not null default '{}',  -- ids de los AJUSTE_DE_SALDO en caja_logs (uno por ejecución)
  aplicado_en   timestamptz not null default now(),   -- última ejecución
  unique (fecha, concepto)
);

-- 4) RLS: mismo criterio que el resto de tablas de la caja (la app opera con la publishable key).
alter table public.yastas_movimientos_portal enable row level security;
alter table public.yastas_import_jobs        enable row level security;
alter table public.yastas_encuadre_ajustes   enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'yastas_movimientos_portal' and policyname = 'caja_all') then
    create policy caja_all on public.yastas_movimientos_portal for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'yastas_import_jobs' and policyname = 'caja_all') then
    create policy caja_all on public.yastas_import_jobs for all to anon, authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'yastas_encuadre_ajustes' and policyname = 'caja_all') then
    create policy caja_all on public.yastas_encuadre_ajustes for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
