// Proxy de SOLO LECTURA hacia la API de Mercado Pago (función serverless de Vercel: /api/mp).
// El token vive en la variable de entorno MP_ACCESS_TOKEN de Vercel, nunca en el código del navegador.
// Cada equipo de la caja manda la clave MP_PROXY_KEY en el encabezado x-caja-key (se captura una sola vez).
// Solo se permiten las dos búsquedas que usa la caja y solo se devuelven los campos que la caja necesita:
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

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'metodo' });
  const token = process.env.MP_ACCESS_TOKEN, clave = process.env.MP_PROXY_KEY;
  if (!token || !clave) return res.status(500).json({ error: 'sin-configurar' });
  if (!claveValida(req.headers['x-caja-key'], clave)) return res.status(401).json({ error: 'clave' });
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
