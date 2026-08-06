// Helper compartido para mandar el aviso de reserva por correo via Resend.

export async function sendEmail(subject, text) {
  const { RESEND_API_KEY, OPS_EMAIL_TO } = process.env;

  const required = { RESEND_API_KEY, OPS_EMAIL_TO };
  const missing = Object.keys(required).filter(k => !required[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno de Resend: ${missing.join(', ')}`);
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Vivir Viajes <onboarding@resend.dev>',
      to: [OPS_EMAIL_TO],
      subject,
      text,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Resend rechazo el envio: ${JSON.stringify(data)}`);
  }
  return data;
}
