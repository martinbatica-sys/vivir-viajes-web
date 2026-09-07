// Helper minimo para hablar con Supabase (tabla "leads") usando su API REST
// (PostgREST) directamente con fetch, sin agregar dependencias nuevas.
// Variables de entorno necesarias en Vercel: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Importante: SUPABASE_SERVICE_ROLE_KEY nunca debe usarse desde el navegador,
// solo desde estas funciones serverless (por eso todo insert/update de leads
// pasa por nuestra propia API, nunca directo desde el cliente).

function config() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel');
  }
  return { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
}

async function sbFetch(path, options = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = config();
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return resp;
}

async function parseOrThrow(resp, action) {
  const text = await resp.text();
  const json = text ? JSON.parse(text) : null;
  if (!resp.ok) {
    throw new Error(`Supabase ${action} error (${resp.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

export async function insertLead(data) {
  const resp = await sbFetch('leads', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });
  const json = await parseOrThrow(resp, 'insert');
  return json && json[0];
}

export async function updateLeadByExternalReference(externalReference, patch) {
  const resp = await sbFetch(`leads?external_reference=eq.${encodeURIComponent(externalReference)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  return parseOrThrow(resp, 'update');
}

export async function updateLeadById(id, patch) {
  const resp = await sbFetch(`leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const json = await parseOrThrow(resp, 'update');
  return json && json[0];
}

export async function listLeads({ limit = 500 } = {}) {
  const resp = await sbFetch(`leads?select=*&order=created_at.desc&limit=${limit}`);
  return parseOrThrow(resp, 'list');
}
