// Endpoint de prueba: manda un WhatsApp de reserva simulada por Twilio.
// Visitar esta URL desde el navegador (GET) dispara el envio.
// Variables de entorno necesarias en Vercel: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OPS_WHATSAPP_TO

import { sendWhatsApp } from '../lib/notify.js';

export default async function handler(req, res) {
  const body = [
    '🏔️ *Nueva reserva - Vivir Viajes* (PRUEBA)',
    'Excursion: Refugio Neumeyer',
    'Fecha: 15/07/2026',
    'Pasajeros: 2 adultos',
    'Total: $500.000',
    'Cliente: Juan Perez',
    'Tel: +54 9 294 000-0000',
    '',
    'Este es un mensaje de prueba del sistema de avisos.',
  ].join('\n');

  try {
    const data = await sendWhatsApp(body);
    return res.status(200).json({ ok: true, sid: data.sid, status: data.status });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
