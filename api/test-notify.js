// Endpoint de prueba: manda un WhatsApp de reserva simulada por Twilio.
// Visitar esta URL desde el navegador (GET) dispara el envio.
// Variables de entorno necesarias en Vercel: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OPS_WHATSAPP_TO

export default async function handler(req, res) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OPS_WHATSAPP_TO } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM || !OPS_WHATSAPP_TO) {
    return res.status(500).json({ error: 'Faltan variables de entorno de Twilio en Vercel' });
  }

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

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({
    To: `whatsapp:${OPS_WHATSAPP_TO}`,
    From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    Body: body,
  });

  const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await twilioResp.json();

  if (!twilioResp.ok) {
    return res.status(twilioResp.status).json({ error: 'Twilio rechazo el envio', detail: data });
  }

  return res.status(200).json({ ok: true, sid: data.sid, status: data.status });
}
