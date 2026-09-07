// Lista los leads (consultas/reservas) del mini-CRM para el panel admin.html.
// Protegido con una contrasenia simple (header x-admin-key).
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

import { listLeads } from '../lib/supabase.js';

export default async function handler(req, res) {
  const { ADMIN_PASSWORD } = process.env;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' });
  }
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const leads = await listLeads({ limit: 500 });
    return res.status(200).json({ ok: true, leads });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
