// Crea una preferencia de pago (Checkout Pro) en Mercado Pago a partir de los
// datos de la reserva, y devuelve la URL a la que redirigir al cliente.
// Variables de entorno necesarias en Vercel: MP_ACCESS_TOKEN
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY para el mini-CRM de leads)

import { insertLead } from '../lib/supabase.js';
import { computeTotal } from '../lib/pricing.js';
import { computeElCruceTotal } from '../lib/elcruce-pricing.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  // Limite generoso: es normal que un cliente real cree varias preferencias
  // mientras ajusta pasajeros u opciones antes de pagar. Esto solo frena un
  // flood/script insistiendo desde la misma IP.
  const rl = rateLimit(req, 'create-preference', { max: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSeconds));
    return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
  }

  const { MP_ACCESS_TOKEN } = process.env;
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Falta configurar MP_ACCESS_TOKEN en Vercel' });
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${req.headers.host}`;
  const externalReference = `VV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // El Cruce (traslado Aeropuerto <-> Cerro Catedral, temporal hasta dic 2026)
  // es un producto aparte de las excursiones: no tiene fecha/DNI/hospedaje ni
  // el modelo de precios con temporadas y traslado opcional de EXC, asi que
  // se arma su propia preferencia en vez de forzarlo al flujo de abajo.
  if (req.body && req.body.product === 'elcruce') {
    return handleElCruce(req, res, { origin, externalReference, MP_ACCESS_TOKEN });
  }

  const {
    excursionId, excursion, opcion, optionKey, fecha, fechaISO, horario, traslado, con, pickup, lagoFrias, lf,
    pasajeros, counts, total, nombre, dni, email, telefono, hospedaje,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid,
  } = req.body || {};

  if (!excursion || !fecha || !total || !nombre || !dni || !email || !telefono || !hospedaje) {
    return res.status(400).json({ error: 'Faltan datos de la reserva' });
  }

  // Nunca confiar en el "total" que manda el navegador: se recalcula aca a
  // partir del mismo precio que ve el cliente (lib/pricing-data.json, un
  // espejo de excursion.html generado por scripts/extract-pricing.mjs).
  const priced = computeTotal({ excursionId, optionKey, counts, con, lf, fechaISO });
  if (!priced.ok) {
    console.error('No se pudo validar el precio de la reserva', { excursionId, optionKey, reason: priced.reason });
    return res.status(400).json({ error: 'No se pudo validar el precio de la reserva', detail: priced.reason });
  }
  if (priced.total !== Number(total)) {
    console.warn('Total recibido del cliente no coincide con el recalculado en el servidor — se usa el del servidor', {
      excursionId, optionKey, clientTotal: total, serverTotal: priced.total,
    });
  }
  const validatedTotal = priced.total;

  // Registrar el lead en el mini-CRM es best-effort: si Supabase no esta
  // configurado o falla, el pago tiene que poder seguir su curso igual.
  try {
    await insertLead({
      channel: 'mercadopago',
      status: 'nuevo',
      excursion_id: excursionId || null,
      excursion,
      opcion: opcion || null,
      fecha,
      pasajeros: pasajeros || null,
      total: validatedTotal,
      nombre,
      dni,
      email,
      telefono,
      hospedaje,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null,
      gclid: gclid || null,
      fbclid: fbclid || null,
      external_reference: externalReference,
    });
  } catch (err) {
    console.error('Error guardando lead en Supabase', err);
  }

  // Permite forzar un monto bajo para probar la integracion real con una
  // tarjeta verdadera sin cobrar el precio completo. Se activa solo si
  // MP_TEST_OVERRIDE_TOTAL esta seteada en Vercel; hay que sacarla despues.
  const { MP_TEST_OVERRIDE_TOTAL } = process.env;
  const isOverride = MP_TEST_OVERRIDE_TOTAL && Number(MP_TEST_OVERRIDE_TOTAL) > 0;
  const unitPrice = isOverride ? Number(MP_TEST_OVERRIDE_TOTAL) : validatedTotal;

  const preference = {
    items: [
      {
        title: `${isOverride ? '[PRUEBA] ' : ''}${excursion}${opcion ? ' - ' + opcion : ''}`,
        quantity: 1,
        unit_price: unitPrice,
        currency_id: 'ARS',
      },
    ],
    payer: {
      name: nombre,
      email,
      identification: { type: 'DNI', number: dni },
    },
    external_reference: externalReference,
    metadata: {
      excursion_id: excursionId || '',
      excursion,
      opcion: opcion || '',
      fecha,
      traslado: traslado || '',
      pickup: pickup || '',
      lago_frias: lagoFrias || '',
      pasajeros: pasajeros || '',
      nombre,
      dni,
      email,
      telefono,
      hospedaje,
    },
    back_urls: (() => {
      const voucherParams = new URLSearchParams({
        exc: excursionId || '',
        excursion,
        opcion: opcion || '',
        fecha,
        horario: horario || '',
        pasajeros: String(pasajeros || ''),
        total: String(unitPrice),
        nombre,
        hospedaje: hospedaje || '',
      }).toString();
      return {
        success: `${origin}/gracias.html?status=success&${voucherParams}`,
        failure: `${origin}/gracias.html?status=failure&${voucherParams}`,
        pending: `${origin}/gracias.html?status=pending&${voucherParams}`,
      };
    })(),
    auto_return: 'approved',
    notification_url: `${origin}/api/mp-webhook`,
  };

  const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  const data = await mpResp.json();

  if (!mpResp.ok) {
    return res.status(mpResp.status).json({ error: 'Mercado Pago rechazo la preferencia', detail: data });
  }

  // Con credenciales TEST- hay que abrir sandbox_init_point; con credenciales
  // de produccion (APP_USR-) se abre init_point. Soporte de MP dio indicaciones
  // contradictorias sobre esto en sandbox, asi que se puede forzar un modo
  // especifico con MP_INIT_POINT_MODE=init|sandbox en Vercel sin tocar codigo.
  const { MP_INIT_POINT_MODE } = process.env;
  const isTest = MP_ACCESS_TOKEN.startsWith('TEST-');
  const initPoint = MP_INIT_POINT_MODE === 'init' ? data.init_point
    : MP_INIT_POINT_MODE === 'sandbox' ? data.sandbox_init_point
    : isTest ? data.sandbox_init_point : data.init_point;

  return res.status(200).json({
    ok: true,
    init_point: initPoint,
    id: data.id,
    init_point_prod: data.init_point,
    init_point_sandbox: data.sandbox_init_point,
  });
}

async function handleElCruce(req, res, { origin, externalReference, MP_ACCESS_TOKEN }) {
  const {
    tramo, sentido, pax, total, nombre, email, telefono, grupo,
    vueloLlegada, horarioLlegada, vueloRegreso, horarioSalida,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid,
  } = req.body || {};

  if (!tramo || !pax || !nombre || !email || !telefono || !grupo) {
    return res.status(400).json({ error: 'Faltan datos de la reserva' });
  }

  const priced = computeElCruceTotal({ tramo, pax });
  if (!priced.ok) {
    console.error('No se pudo validar el precio del traslado El Cruce', { tramo, pax, reason: priced.reason });
    return res.status(400).json({ error: 'No se pudo validar el precio de la reserva', detail: priced.reason });
  }
  if (priced.total !== Number(total)) {
    console.warn('Total recibido del cliente no coincide con el recalculado en el servidor (El Cruce) — se usa el del servidor', {
      clientTotal: total, serverTotal: priced.total,
    });
  }
  const validatedTotal = priced.total;
  const excursionLabel = `Traslado El Cruce · ${tramo}`;
  const pasajerosTxt = `${pax} ${Number(pax) === 1 ? 'corredor' : 'corredores'}`;

  try {
    await insertLead({
      channel: 'mercadopago',
      status: 'nuevo',
      excursion_id: 'elcruce',
      excursion: excursionLabel,
      opcion: sentido || null,
      fecha: grupo,
      pasajeros: pasajerosTxt,
      total: validatedTotal,
      nombre,
      dni: null,
      email,
      telefono,
      hospedaje: null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null,
      gclid: gclid || null,
      fbclid: fbclid || null,
      external_reference: externalReference,
    });
  } catch (err) {
    console.error('Error guardando lead en Supabase (El Cruce)', err);
  }

  const { MP_TEST_OVERRIDE_TOTAL } = process.env;
  const isOverride = MP_TEST_OVERRIDE_TOTAL && Number(MP_TEST_OVERRIDE_TOTAL) > 0;
  const unitPrice = isOverride ? Number(MP_TEST_OVERRIDE_TOTAL) : validatedTotal;

  const preference = {
    items: [
      {
        title: `${isOverride ? '[PRUEBA] ' : ''}${excursionLabel}`,
        quantity: 1,
        unit_price: unitPrice,
        currency_id: 'ARS',
      },
    ],
    payer: { name: nombre, email },
    external_reference: externalReference,
    metadata: {
      excursion_id: 'elcruce',
      excursion: excursionLabel,
      tramo,
      sentido: sentido || '',
      pax: String(pax),
      grupo,
      vuelo_llegada: vueloLlegada || '',
      horario_llegada: horarioLlegada || '',
      vuelo_regreso: vueloRegreso || '',
      horario_salida: horarioSalida || '',
      nombre,
      email,
      telefono,
    },
    back_urls: (() => {
      const voucherParams = new URLSearchParams({
        producto: 'elcruce',
        tramo,
        sentido: sentido || '',
        pax: String(pax),
        grupo,
        vuelo_llegada: vueloLlegada || '',
        horario_llegada: horarioLlegada || '',
        vuelo_regreso: vueloRegreso || '',
        horario_salida: horarioSalida || '',
        total: String(unitPrice),
        nombre,
      }).toString();
      return {
        success: `${origin}/gracias.html?status=success&${voucherParams}`,
        failure: `${origin}/gracias.html?status=failure&${voucherParams}`,
        pending: `${origin}/gracias.html?status=pending&${voucherParams}`,
      };
    })(),
    auto_return: 'approved',
    notification_url: `${origin}/api/mp-webhook`,
  };

  const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  const data = await mpResp.json();

  if (!mpResp.ok) {
    return res.status(mpResp.status).json({ error: 'Mercado Pago rechazo la preferencia', detail: data });
  }

  const { MP_INIT_POINT_MODE } = process.env;
  const isTest = MP_ACCESS_TOKEN.startsWith('TEST-');
  const initPoint = MP_INIT_POINT_MODE === 'init' ? data.init_point
    : MP_INIT_POINT_MODE === 'sandbox' ? data.sandbox_init_point
    : isTest ? data.sandbox_init_point : data.init_point;

  return res.status(200).json({
    ok: true,
    init_point: initPoint,
    id: data.id,
    init_point_prod: data.init_point,
    init_point_sandbox: data.sandbox_init_point,
  });
}
