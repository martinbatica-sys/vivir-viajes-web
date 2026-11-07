// Crea un lead en blanco desde el panel admin.html, para cargar a mano una
// reserva que entro por un canal que no pasa por el sitio (telefono, etc).
// Protegido con ADMIN_PASSWORD unicamente, igual que admin-update-lead.js.
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

import { insertLead } from '../lib/supabase.js';
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

  try {
    const lead = await insertLead({
      channel: 'whatsapp',
      status: 'nuevo',
      excursion_id: null,
      excursion: null,
      opcion: null,
      fecha: null,
      pasajeros: null,
      total: null,
      nombre: null,
      dni: null,
      email: null,
      telefono: null,
      hospedaje: null,
      notes: null,
      carga_sistema: null,
    });
    return res.status(200).json({ ok: true, lead });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
