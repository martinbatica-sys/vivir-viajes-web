// Registra una consulta/reserva en el mini-CRM (tabla "leads" de Supabase).
// Se llama tanto al pedir una cotizacion por WhatsApp como al iniciar un pago.
// Nunca debe romper el flujo del cliente: si falla, respondemos 200 igual.
// Variables de entorno necesarias en Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { insertLead } from '../lib/supabase.js';
import { rateLimit } from '../lib/rate-limit.js';
import { sendEmail } from '../lib/notify-email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  // Mismo espiritu best-effort que el resto del archivo: si alguien floodea
  // este endpoint no le mostramos un error, simplemente dejamos de guardar
  // leads de esa IP por un rato.
  const rl = rateLimit(req, 'log-lead', { max: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return res.status(200).json({ ok: false, error: 'rate_limited' });
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
      notes: b.notes || null,
    });

    // Las consultas de agencias (Receptivo) no pasan por WhatsApp como el
    // resto de los leads, asi que ese "aviso instantaneo" no existe para
    // ellas — sin este mail, la unica forma de enterarse seria revisar el
    // mini-CRM a mano.
    if (b.channel === 'receptivo') {
      try {
        const body = [
          '🤝 Nueva consulta de agencia - Vivir Viajes',
          `Agencia/Contacto: ${b.nombre || '-'}`,
          `Email: ${b.email || '-'}`,
          `Tel: ${b.telefono || '-'}`,
          '',
          b.notes || '',
        ].join('\n');
        await sendEmail('Nueva consulta de agencia (Receptivo) - Vivir Viajes', body);
      } catch (err) {
        console.error('Error mandando el mail de consulta de agencia', err);
      }
    }

    return res.status(200).json({ ok: true, id: lead && lead.id });
  } catch (err) {
    console.error('Error guardando lead en Supabase', err);
    // No devolvemos error 500: registrar el lead es best-effort, nunca debe
    // bloquear ni mostrarle un problema al cliente que esta reservando.
    return res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
