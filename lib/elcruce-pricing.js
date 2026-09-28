// Precio del traslado El Cruce 2026: tarifa plana por pasajero segun tramo,
// sin temporadas ni traslado opcional como las excursiones — por eso vive
// aparte de lib/pricing.js en vez de forzarlo al molde de EXC/computeTotal.
// Nunca hay que confiar en el total que manda el navegador: se recalcula aca.

const PRECIOS = { Ida: 30000, 'Ida y vuelta': 60000 };

/**
 * @returns {{ok:true, total:number}|{ok:false, reason:string}}
 */
export function computeElCruceTotal({ tramo, pax }) {
  const unit = PRECIOS[tramo];
  if (!unit) return { ok: false, reason: 'tramo_desconocido' };

  const n = Number(pax);
  if (!Number.isInteger(n) || n < 1 || n > 20) return { ok: false, reason: 'cantidad_invalida' };

  return { ok: true, total: unit * n };
}
