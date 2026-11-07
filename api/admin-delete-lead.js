// Elimina un lead desde el panel admin.html.
// Protegido con ADMIN_PASSWORD unicamente (header x-admin-key) - igual que
// admin-update-lead.js, los accesos de solo lectura no pueden borrar leads.
// Solo se puede borrar un lead cargado a mano (external_reference
// "MANUAL-...", ver admin-create-lead.js) - los que vienen por formularios
// o compras del sitio no se pueden eliminar (lib/supabase.js lo valida).
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

import { deleteManualLeadById } from '../lib/supabase.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { ADMIN_PASSWORD } = process.env;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' });
  }
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD) {
    const rl = rateLimit(req, 'admin-login', { max: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
    }
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Falta id' });
  }

  try {
    const deleted = await deleteManualLeadById(id);
    if (!deleted) {
      return res.status(403).json({ ok: false, error: 'Solo se pueden eliminar los leads cargados a mano' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
