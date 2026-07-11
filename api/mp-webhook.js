// Webhook de Mercado Pago: se llama solo cuando cambia el estado de un pago.
// Si el pago esta aprobado, arma el aviso de reserva y lo manda por WhatsApp
// a la mesa de operaciones.
// Variables de entorno necesarias en Vercel: MP_ACCESS_TOKEN (+ las de Twilio)

import { sendWhatsApp } from '../lib/notify.js';

export default async function handler(req, res) {
  try {
    const topic = req.query.topic || req.body?.type;
    const paymentId = req.query.id || req.body?.data?.id;

    if (topic !== 'payment' || !paymentId) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const { MP_ACCESS_TOKEN } = process.env;
    if (!MP_ACCESS_TOKEN) {
      console.error('Falta MP_ACCESS_TOKEN');
      return res.status(500).json({ ok: false });
    }

    const payResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await payResp.json();

    if (!payResp.ok) {
      console.error('Error consultando el pago en Mercado Pago', payment);
      return res.status(200).json({ ok: false });
    }

    if (payment.status !== 'approved') {
      return res.status(200).json({ ok: true, status: payment.status });
    }

    const m = payment.metadata || {};
    const body = [
      '🏔️ *Nueva reserva pagada - Vivir Viajes*',
      `Excursion: ${m.excursion || '-'}`,
      m.opcion ? `Opcion: ${m.opcion}` : null,
      `Fecha: ${m.fecha || '-'}`,
      m.traslado ? `Traslado: ${m.traslado}` : null,
      m.pickup ? `Pick up: ${m.pickup}` : null,
      m.lago_frias ? `Lago Frias: ${m.lago_frias}` : null,
      `Pasajeros: ${m.pasajeros || '-'}`,
      `Total pagado: $${payment.transaction_amount}`,
      `Cliente: ${m.nombre || '-'}`,
      `Tel: ${m.telefono || '-'}`,
      `Hospedaje: ${m.hospedaje || '-'}`,
      `Referencia: ${payment.external_reference || '-'}`,
    ].filter(Boolean).join('\n');

    await sendWhatsApp(body);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
