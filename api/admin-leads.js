// Lista los leads (consultas/reservas) del mini-CRM para el panel admin.html.
// Protegido con una contrasenia simple (header x-admin-key). Acepta dos
// contrasenias distintas: ADMIN_PASSWORD (acceso completo, puede editar) y
// VIEWER_PASSWORD (opcional, solo lectura - para compartir con terceros
// como la agencia de marketing sin darles permiso de edicion).
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, opcional VIEWER_PASSWORD)

import { listLeads } from '../lib/supabase.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  const { ADMIN_PASSWORD, VIEWER_PASSWORD } = process.env;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' });
  }
  const key = req.headers['x-admin-key'];
  let role = null;
  if (key === ADMIN_PASSWORD) role = 'admin';
  else if (VIEWER_PASSWORD && key === VIEWER_PASSWORD) role = 'viewer';
  if (!role) {
    // Solo se cuentan los intentos fallidos, para no afectar nunca a un
    // admin ya logueado que recarga la pagina normalmente.
    const rl = rateLimit(req, 'admin-login', { max: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
    }
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const leads = await listLeads({ limit: 500 });
    return res.status(200).json({ ok: true, leads, role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
