// Registra una consulta/reserva en el mini-CRM (tabla "leads" de Supabase).
// Se llama tanto al pedir una cotizacion por WhatsApp como al iniciar un pago.
// Nunca debe romper el flujo del cliente: si falla, respondemos 200 igual.
// Variables de entorno necesarias en Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { insertLead } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const b = req.body || {};

  try {
    const lead = await insertLead({
      channel: b.channel || 'whatsapp',
      status: 'nuevo',
      excursion_id: b.excursionId || null,
      excursion: b.excursion || null,
      opcion: b.opcion || null,
      fecha: b.fecha || null,
      pasajeros: b.pasajeros || null,
      total: b.total || null,
      nombre: b.nombre || null,
      dni: b.dni || null,
      email: b.email || null,
      telefono: b.telefono || null,
      hospedaje: b.hospedaje || null,
      utm_source: b.utm_source || null,
      utm_medium: b.utm_medium || null,
      utm_campaign: b.utm_campaign || null,
      utm_term: b.utm_term || null,
      utm_content: b.utm_content || null,
      gclid: b.gclid || null,
      fbclid: b.fbclid || null,
      external_reference: b.externalReference || null,
    });
    return res.status(200).json({ ok: true, id: lead && lead.id });
  } catch (err) {
    console.error('Error guardando lead en Supabase', err);
    // No devolvemos error 500: registrar el lead es best-effort, nunca debe
    // bloquear ni mostrarle un problema al cliente que esta reservando.
    return res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
