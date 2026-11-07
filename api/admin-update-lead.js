// Actualiza cualquier campo editable de un lead desde el panel admin.html.
// Protegido con ADMIN_PASSWORD unicamente (header x-admin-key) - a
// diferencia de admin-leads.js, aca NO se acepta VIEWER_PASSWORD: los
// accesos de solo lectura no pueden editar leads.
// Variables de entorno necesarias en Vercel: ADMIN_PASSWORD
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)

import { updateLeadById } from '../lib/supabase.js';
import { rateLimit } from '../lib/rate-limit.js';

const VALID_STATUSES = ['nuevo', 'contactado', 'cotizado', 'recontactar', 'pendiente_pago', 'ganado', 'perdido'];
const VALID_CARGA = ['cargado', 'pendiente'];
const VALID_CHANNELS = ['mercadopago', 'whatsapp'];

// Misma lista fija que usa admin.html para el desplegable de Excursion
// (los 25 ids de excursion.html + El Cruce + Rent a Car + Receptivo).
const VALID_EXCURSION_IDS = [
  null, 'la-cueva', 'eas', 'roca-negra', 'san-ramon', 'cabalgata-wesley', 'neumeyer',
  'circuito-chico', 'circuito-chico-campanario', 'villa-bayo', 'campo-tulipanes',
  'san-martin', 'circuito-grande', 'bolson-lago-puelo', 'rafting-frontera',
  'rafting-villegas', 'kayak', 'tronador', 'isla-victoria', 'puerto-blest',
  'mini-cat', 'cerro-catedral', 'beer-experience-clasico', 'beer-experience-sunset',
  'nieve-al-limite', 'cerro-otto', 'elcruce',
];

function isFreeText(v) {
  return v === null || typeof v === 'string';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { ADMIN_PASSWORD } = process.env;
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel' });
  }
  if (req.headers['x-admin-key'] !== ADMIN_PASSWORD) {
    // Mismo contador que admin-leads.js: comparten credencial, asi que
    // comparten tambien el limite de intentos fallidos.
    const rl = rateLimit(req, 'admin-login', { max: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
    }
    return res.status(401).json({ error: 'No autorizado' });
  }

  const {
    id, status, notes, carga_sistema, channel, excursion, excursion_id, fecha,
    created_at, nombre, dni, telefono, email, hospedaje, pasajeros, total,
    utm_source, utm_campaign, gclid, fbclid,
  } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'Falta id' });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado invalido' });
  }
  if (carga_sistema !== undefined && !VALID_CARGA.includes(carga_sistema)) {
    return res.status(400).json({ error: 'Valor de carga_sistema invalido' });
  }
  if (channel !== undefined && !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Canal invalido' });
  }
  if (excursion_id !== undefined && !VALID_EXCURSION_IDS.includes(excursion_id)) {
    return res.status(400).json({ error: 'Excursion invalida' });
  }
  if (created_at !== undefined && isNaN(Date.parse(created_at))) {
    return res.status(400).json({ error: 'Fecha invalida' });
  }
  if (total !== undefined && total !== null && isNaN(Number(total))) {
    return res.status(400).json({ error: 'Total invalido' });
  }
  for (const [key, v] of Object.entries({
    excursion, fecha, nombre, dni, telefono, email, hospedaje, pasajeros,
    utm_source, utm_campaign, gclid, fbclid,
  })) {
    if (v !== undefined && !isFreeText(v)) {
      return res.status(400).json({ error: `Valor invalido para ${key}` });
    }
  }

  const patch = { updated_at: new Date().toISOString() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  if (carga_sistema !== undefined) patch.carga_sistema = carga_sistema;
  if (channel !== undefined) patch.channel = channel;
  if (excursion !== undefined) patch.excursion = excursion;
  if (excursion_id !== undefined) patch.excursion_id = excursion_id;
  if (fecha !== undefined) patch.fecha = fecha;
  if (created_at !== undefined) patch.created_at = created_at;
  if (nombre !== undefined) patch.nombre = nombre;
  if (dni !== undefined) patch.dni = dni;
  if (telefono !== undefined) patch.telefono = telefono;
  if (email !== undefined) patch.email = email;
  if (hospedaje !== undefined) patch.hospedaje = hospedaje;
  if (pasajeros !== undefined) patch.pasajeros = pasajeros;
  if (total !== undefined) patch.total = total === null ? null : Number(total);
  if (utm_source !== undefined) patch.utm_source = utm_source;
  if (utm_campaign !== undefined) patch.utm_campaign = utm_campaign;
  if (gclid !== undefined) patch.gclid = gclid;
  if (fbclid !== undefined) patch.fbclid = fbclid;

  try {
    const lead = await updateLeadById(id, patch);
    return res.status(200).json({ ok: true, lead });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
