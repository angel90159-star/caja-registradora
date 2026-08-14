-- Agrega columna dedicada "yastas_getnet" a caja_balances para el retiro tipo Getnet dentro de Yastás.
-- Saldo diario que se reinicia a 0 en cada cierre de turno (igual que la columna "vales").
alter table public.caja_balances
  add column if not exists yastas_getnet numeric not null default 0;
