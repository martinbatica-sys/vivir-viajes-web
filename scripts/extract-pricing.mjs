// Extrae del EXC de excursion.html solo los datos necesarios para
// recalcular precios en el servidor (api/create-preference.js), y los
// escribe en lib/pricing-data.json.
//
// Por que existe este script: el precio real de cada excursion vive en
// excursion.html (para no duplicar a mano en dos lugares y desincronizar),
// pero ese archivo se ejecuta en el navegador. Este script lo evalua en un
// sandbox de Node y vuelca a JSON solo los campos de precio, para que el
// backend pueda validar el total sin confiar en lo que manda el cliente.
//
// Correr despues de cualquier cambio de precios en excursion.html:
//   node scripts/extract-pricing.mjs

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excursionHtmlPath = path.join(__dirname, '..', 'excursion.html');
const outPath = path.join(__dirname, '..', 'lib', 'pricing-data.json');

const html = readFileSync(excursionHtmlPath, 'utf-8');

function extractBlock(source, startMarker) {
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) throw new Error(`No se encontro "${startMarker}" en excursion.html`);
  const braceStart = source.indexOf('{', startIdx);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  throw new Error(`Llaves desbalanceadas extrayendo "${startMarker}"`);
}

const aFn = "const A  = (extra={}) => Object.assign({key:'adulto',label:'Adultos',min:1},extra);";
const mFn = "const M  = (extra={}) => Object.assign({key:'menor',label:'Menores',min:0},extra);";
const excBlock = extractBlock(html, 'const EXC = ');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${aFn}\n${mFn}\n${excBlock};\nthis.EXC = EXC;`, sandbox);
const EXC = sandbox.EXC;

if (!EXC || typeof EXC !== 'object') {
  throw new Error('No se pudo evaluar el objeto EXC');
}

const pricing = {};
for (const [excId, exc] of Object.entries(EXC)) {
  if (exc.cotizar) continue; // se cotiza por WhatsApp, nunca pasa por Mercado Pago

  const opciones = {};
  for (const opt of exc.opciones || []) {
    if (!opt.cats || !opt.precios) continue; // opcion sin precio propio (no deberia pasar)
    opciones[opt.key] = {
      cats: opt.cats.map(c => ({ key: c.key, min: c.min || 0, max: c.max ?? null })),
      precios: opt.precios,
      preciosLF: opt.preciosLF || null,
      groupDiscount: opt.groupDiscount || null,
    };
  }
  if (Object.keys(opciones).length === 0) continue;

  pricing[excId] = {
    seasonal: !!exc.seasonal,
    temporadas: exc.seasonal ? (exc.temporadas || []).map(t => ({ key: t.key, rangos: t.rangos })) : null,
    traslado: !!exc.traslado,
    lagoFrias: !!exc.lagoFrias,
    opciones,
  };
}

writeFileSync(outPath, JSON.stringify(pricing, null, 2) + '\n');
console.log(`OK: ${Object.keys(pricing).length} excursiones escritas en ${path.relative(process.cwd(), outPath)}`);
