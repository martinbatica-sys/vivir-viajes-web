// Recalcula el precio de una reserva en el servidor, a partir de los mismos
// datos de precios que usa excursion.html (ver lib/pricing-data.json,
// generado por scripts/extract-pricing.mjs). Nunca hay que confiar en el
// "total" que manda el navegador para cobrar: hay que recalcularlo aca.
//
// Esta logica es un espejo fiel de seasonKeyFor/priceFor/pricingFor en
// excursion.html. Si esas funciones cambian, hay que actualizar esta
// tambien.

import pricingData from './pricing-data.json' with { type: 'json' };

function seasonKeyFor(exc, dateStr) {
  if (!exc.seasonal || !dateStr) return null;
  const md = dateStr.slice(5);
  for (const t of exc.temporadas || []) {
    for (const [a, b] of t.rangos) {
      if (a.length > 5) {
        if (dateStr >= a && dateStr <= b) return t.key;
      } else if (md >= a && md <= b) {
        return t.key;
      }
    }
  }
  return '__off__';
}

function leaf(opt, catKey, sk) {
  let p = opt.precios;
  if (sk && sk !== '__off__') p = p[sk];
  return p ? p[catKey] : undefined;
}

function priceFor(opt, catKey, sk, con, lf) {
  const v = leaf(opt, catKey, sk);
  let base = v && typeof v === 'object' ? (con ? v.con : v.sin) : v || 0;
  if (lf && opt.preciosLF && opt.preciosLF[catKey] !== undefined) {
    base += opt.preciosLF[catKey] || 0;
  }
  return base;
}

/**
 * Recalcula el total de una reserva en el servidor.
 * @returns {{ok:true, total:number, pax:number}|{ok:false, reason:string}}
 */
export function computeTotal({ excursionId, optionKey, counts, con, lf, fechaISO }) {
  const exc = pricingData[excursionId];
  if (!exc) return { ok: false, reason: 'excursion_desconocida' };

  const opt = exc.opciones[optionKey];
  if (!opt) return { ok: false, reason: 'opcion_desconocida' };

  if (exc.seasonal && !fechaISO) return { ok: false, reason: 'falta_fecha' };
  const sk = exc.seasonal ? seasonKeyFor(exc, fechaISO) : null;
  if (sk === '__off__') return { ok: false, reason: 'fuera_de_temporada' };

  const safeCounts = counts && typeof counts === 'object' ? counts : {};
  let pax = 0;
  let subtotal = 0;
  for (const c of opt.cats) {
    const n = Number(safeCounts[c.key]) || 0;
    if (n < 0 || !Number.isInteger(n)) return { ok: false, reason: 'cantidad_invalida' };
    if (n < c.min) return { ok: false, reason: 'cantidad_invalida' };
    if (c.max != null && n > c.max) return { ok: false, reason: 'cantidad_invalida' };
    pax += n;
    subtotal += n * priceFor(opt, c.key, sk, !!con, !!lf);
  }

  if (pax <= 0) return { ok: false, reason: 'sin_pasajeros' };

  let discount = 0;
  if (opt.groupDiscount && pax >= opt.groupDiscount.minPax) {
    discount = Math.round(subtotal * opt.groupDiscount.pct);
  }

  return { ok: true, total: subtotal - discount, pax };
}
