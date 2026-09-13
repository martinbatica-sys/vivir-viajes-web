// Limitador de tasa simple, en memoria, por IP.
//
// No sobrevive un cold start ni se comparte entre instancias distintas de la
// funcion serverless — pero frena el caso real para un sitio de este tamano:
// alguien (o un script simple) insistiendo desde la misma IP en un ratito
// corto, como probar contraseñas del panel de admin o floodear un endpoint
// publico. Si en el futuro hace falta algo a prueba de cold start / multiples
// instancias, esto habria que pasarlo a una tabla de Supabase o a Redis
// (Upstash).

const buckets = new Map();

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Poda perezosa: si el mapa acumula muchas IPs/ventanas vencidas, se limpia
// en cada llamada para no crecer memoria indefinidamente.
function prune(now) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (now - b.windowStart > b.windowMs) buckets.delete(key);
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} scope - nombre del endpoint/uso, para no mezclar contadores entre rutas
 * @param {{max:number, windowMs:number}} opts
 * @returns {{allowed:boolean, retryAfterSeconds?:number}}
 */
export function rateLimit(req, scope, { max, windowMs }) {
  const ip = getIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  prune(now);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 0, windowStart: now, windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;

  if (bucket.count > max) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}
