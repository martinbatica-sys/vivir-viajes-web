// Endpoint de prueba: manda un correo de reserva simulada via Resend.
// Visitar esta URL desde el navegador (GET) dispara el envio.
// Variables de entorno necesarias en Vercel: RESEND_API_KEY, OPS_EMAIL_TO

import { sendEmail } from '../lib/notify-email.js';

export default async function handler(req, res) {
  const body = [
    '🏔️ Nueva reserva - Vivir Viajes (PRUEBA)',
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
    const data = await sendEmail('Nueva reserva - Vivir Viajes (PRUEBA)', body);
    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
