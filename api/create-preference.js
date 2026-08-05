// Crea una preferencia de pago (Checkout Pro) en Mercado Pago a partir de los
// datos de la reserva, y devuelve la URL a la que redirigir al cliente.
// Variables de entorno necesarias en Vercel: MP_ACCESS_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { MP_ACCESS_TOKEN } = process.env;
  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Falta configurar MP_ACCESS_TOKEN en Vercel' });
  }

  const {
    excursionId, excursion, opcion, fecha, traslado, pickup, lagoFrias,
    pasajeros, total, nombre, telefono, hospedaje,
  } = req.body || {};

  if (!excursion || !fecha || !total || !nombre || !telefono || !hospedaje) {
    return res.status(400).json({ error: 'Faltan datos de la reserva' });
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${req.headers.host}`;
  const externalReference = `VV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Permite forzar un monto bajo para probar la integracion real con una
  // tarjeta verdadera sin cobrar el precio completo. Se activa solo si
  // MP_TEST_OVERRIDE_TOTAL esta seteada en Vercel; hay que sacarla despues.
  const { MP_TEST_OVERRIDE_TOTAL } = process.env;
  const isOverride = MP_TEST_OVERRIDE_TOTAL && Number(MP_TEST_OVERRIDE_TOTAL) > 0;
  const unitPrice = isOverride ? Number(MP_TEST_OVERRIDE_TOTAL) : Number(total);

  const preference = {
    items: [
      {
        title: `${isOverride ? '[PRUEBA] ' : ''}${excursion}${opcion ? ' - ' + opcion : ''}`,
        quantity: 1,
        unit_price: unitPrice,
        currency_id: 'ARS',
      },
    ],
    payer: { name: nombre },
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
      telefono,
      hospedaje,
    },
    back_urls: {
      success: `${origin}/gracias.html?status=success&exc=${encodeURIComponent(excursionId || '')}`,
      failure: `${origin}/gracias.html?status=failure&exc=${encodeURIComponent(excursionId || '')}`,
      pending: `${origin}/gracias.html?status=pending&exc=${encodeURIComponent(excursionId || '')}`,
    },
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
