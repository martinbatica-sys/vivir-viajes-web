// Actualiza el estado/notas de un lead desde el panel admin.html.
// Protegido con ADMIN_PASSWORD unicamente (header x-admin-key) - a
// diferencia de admin-leads.js, aca NO se acepta VIEWER_PASSWORD: los
// accesos de solo lectura no pueden editar leads.
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

import { updateLeadById } from '../lib/supabase.js';

const VALID_STATUSES = ['nuevo', 'contactado', 'cotizado', 'ganado', 'perdido'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { ADMIN_PASSWORD } = process.env;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' });
  }
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { id, status, notes } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Falta id' });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado invalido' });
  }

  const patch = { updated_at: new Date().toISOString() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;

  try {
    const lead = await updateLeadById(id, patch);
    return res.status(200).json({ ok: true, lead });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
