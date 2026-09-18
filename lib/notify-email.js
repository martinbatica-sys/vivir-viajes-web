// Helper compartido para mandar el aviso de reserva por correo via Resend.

export async function sendEmail(subject, text, idempotencyKey) {
  const { RESEND_API_KEY, OPS_EMAIL_TO } = process.env;

  const required = { RESEND_API_KEY, OPS_EMAIL_TO };
  const missing = Object.keys(required).filter(k => !required[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno de Resend: ${missing.join(', ')}`);
  }

  const headers = {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  // Evita mandar el mismo aviso dos veces si Resend recibe el mismo pedido
  // repetido (por ejemplo, Mercado Pago reenviando el webhook del mismo pago).
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: 'Vivir Viajes <onboarding@resend.dev>',
      // OPS_EMAIL_TO admite varias direcciones separadas por coma
      // (ej: "martinbatica@vivirviajes.com.ar,sole@vivirviajes.com.ar").
      to: OPS_EMAIL_TO.split(',').map(e => e.trim()).filter(Boolean),
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
