// Proxy de SOLO LECTURA hacia la API de Mercado Pago (función serverless de Vercel: /api/mp).
// El token vive en la variable de entorno MP_ACCESS_TOKEN de Vercel, nunca en el código del navegador.
// Cada equipo de la caja manda la clave MP_PROXY_KEY en el encabezado x-caja-key (se captura una sola vez).
// Solo se permiten las consultas que usa la caja (pagos, órdenes y rendimientos GBM) y solo se devuelven los campos que la caja necesita:
// nada de nombres, correos, RFC ni datos de tarjeta de clientes.
const crypto = require('crypto');

const CONSULTAS = {
  pagos: { ruta: 'v1/payments/search', params: ['sort', 'criteria', 'limit', 'offset', 'range', 'begin_date', 'end_date'] },
  ordenes: { ruta: 'merchant_orders/search', params: ['limit', 'offset'] },
};

function claveValida(recibida, esperada) {
  const a = Buffer.from(String(recibida || '')), b = Buffer.from(String(esperada));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function limpiarPago(p) {
  return {
    id: p.id,
    date_created: p.date_created,
    status: p.status,
    status_detail: p.status_detail,
    operation_type: p.operation_type,
    description: p.description,
    external_reference: p.external_reference,
    collector_id: p.collector_id,
    transaction_amount: p.transaction_amount,
    transaction_amount_refunded: p.transaction_amount_refunded,
    transaction_details: { net_received_amount: (p.transaction_details || {}).net_received_amount },
    point_of_interaction: { type: (p.point_of_interaction || {}).type },
    accounts_info: p.accounts_info ? { type: p.accounts_info.type } : null,
  };
}

function limpiarOrden(o) {
  return {
    id: o.id,
    payouts: (o.payouts || []).map((x) => ({
      id: x.id, type: x.type, amount: x.amount, total_amount: x.total_amount, status: x.status, status_detail: x.status_detail, date_created: x.date_created,
    })),
  };
}

// Rendimientos de GBM: no salen en payments/search, solo en el reporte "Todas las transacciones" (settlement_report)
// como SETTLEMENT positivo sin método de pago. Se pide UN reporte al día (solo si hoy no existe ya uno que cubra `desde`,
// aunque siga en preparación) y se leen los renglones del reporte procesado más reciente que cubra `desde`; `pendiente`
// avisa que el de hoy aún se está armando (tarda ~2 min). Solo salen del servidor id, monto y fecha de esos renglones.
const MP = 'https://api.mercadopago.com/v1/account/settlement_report';

function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];
  const sep = lineas[0].split(';').length >= lineas[0].split(',').length ? ';' : ',';
  const cab = lineas[0].split(sep);
  return lineas.slice(1).map((l) => {
    const v = l.split(sep);
    return Object.fromEntries(cab.map((c, i) => [c, v[i] || '']));
  });
}

async function rendimientosGbm(token, desde) {
  const h = { Authorization: `Bearer ${token}` };
  const r = await fetch(`${MP}/list`, { headers: h });
  if (!r.ok) return { error: 'mercadopago', status: r.status };
  const lista = (await r.json()) || [];
  const inicio = new Date(`${desde}T00:00:00-06:00`).getTime();
  const fechaDe = (x) => new Date(x.generation_date || x.date_created || x.last_modified || 0).getTime();
  const diaMx = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const cubreDesde = (x) => new Date(x.begin_date).getTime() <= inicio;
  const cubren = lista.filter((x) => x.status === 'processed' && x.file_name && cubreDesde(x))
    .sort((a, b) => fechaDe(b) - fechaDe(a) || b.id - a.id);
  const deHoy = lista.filter((x) => cubreDesde(x) && fechaDe(x) && diaMx(fechaDe(x)) === diaMx(Date.now()));
  let solicitado = false;
  if (!deHoy.length) {
    const p = await fetch(MP, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ begin_date: new Date(inicio).toISOString(), end_date: new Date().toISOString() }) });
    solicitado = p.status === 202;
  }
  const pendiente = solicitado || (deHoy.length > 0 && !deHoy.some((x) => x.status === 'processed'));
  if (!cubren.length) return { reporte: null, solicitado, pendiente, rendimientos: [] };
  const d = await fetch(`${MP}/${encodeURIComponent(cubren[0].file_name)}`, { headers: h });
  if (!d.ok) return { error: 'mercadopago', status: d.status };
  const rendimientos = leerCsv(await d.text())
    .filter((f) => f.TRANSACTION_TYPE === 'SETTLEMENT' && !f.PAYMENT_METHOD_TYPE && parseFloat(f.REAL_AMOUNT || f.TRANSACTION_AMOUNT) > 0)
    .map((f) => ({ id: f.SOURCE_ID, monto: Math.round(parseFloat(f.REAL_AMOUNT || f.TRANSACTION_AMOUNT) * 100) / 100, fecha: f.TRANSACTION_DATE }));
  return { reporte: { id: cubren[0].id, generado: new Date(fechaDe(cubren[0])).toISOString() }, solicitado, pendiente, rendimientos };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'metodo' });
  const token = process.env.MP_ACCESS_TOKEN, clave = process.env.MP_PROXY_KEY;
  if (!token || !clave) return res.status(500).json({ error: 'sin-configurar' });
  if (!claveValida(req.headers['x-caja-key'], clave)) return res.status(401).json({ error: 'clave' });
  if (req.query.tipo === 'gbm') {
    const desde = String(req.query.desde || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return res.status(400).json({ error: 'desde' });
    try {
      const r = await rendimientosGbm(token, desde);
      return r.error ? res.status(502).json(r) : res.status(200).json(r);
    } catch (err) {
      return res.status(502).json({ error: 'red' });
    }
  }
  const consulta = CONSULTAS[req.query.tipo];
  if (!consulta) return res.status(400).json({ error: 'tipo' });

  const qs = new URLSearchParams();
  consulta.params.forEach((k) => { if (req.query[k] != null) qs.set(k, String(req.query[k])); });
  try {
    const r = await fetch(`https://api.mercadopago.com/${consulta.ruta}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    // 502 = Mercado Pago rechazó o falló (distinto del 401 de clave del proxy).
    if (!r.ok) return res.status(502).json({ error: 'mercadopago', status: r.status });
    const data = await r.json();
    if (req.query.tipo === 'pagos') {
      return res.status(200).json({ paging: data.paging || {}, results: (data.results || []).map(limpiarPago) });
    }
    return res.status(200).json({ total: data.total || 0, elements: (data.elements || []).map(limpiarOrden) });
  } catch (err) {
    return res.status(502).json({ error: 'red' });
  }
};
