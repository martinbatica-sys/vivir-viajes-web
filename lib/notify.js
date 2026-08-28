// Helper compartido para mandar el aviso de reserva por WhatsApp via Twilio.

export async function sendWhatsApp(body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OPS_WHATSAPP_TO } = process.env;

  const required = { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OPS_WHATSAPP_TO };
  const missing = Object.keys(required).filter(k => !required[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno de Twilio: ${missing.join(', ')}`);
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const params = new URLSearchParams({
    To: `whatsapp:${OPS_WHATSAPP_TO}`,
    From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    Body: body,
  });

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Twilio rechazo el envio: ${JSON.stringify(data)}`);
  }
  return data;
}
