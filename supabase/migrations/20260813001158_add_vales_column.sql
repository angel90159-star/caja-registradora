-- Agrega columna dedicada "vales" a caja_balances para el nuevo módulo Vales.
-- Saldo diario que se reinicia a 0 en cada cierre de turno (igual que bbva, tconecta, transferencia, capital).
alter table public.caja_balances
  add column if not exists vales numeric not null default 0;
