// POST /api/plan  { email, pedido, respuestas }  →  { rutina, dieta, restantes }
// Solo se descuenta un plan si la IA ha devuelto al menos la rutina o la dieta.
import { comprobarPedido, sumarUso, LIMITE } from '../lib/shopify.js';
import { limpiarRespuestas, promptRutina, promptDieta } from '../lib/prompts.js';
import { pedirJSON } from '../lib/ia.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, mensaje: 'Método no permitido.' });

  const acceso = await comprobarPedido(req.body?.email, req.body?.pedido);
  if (!acceso.ok) return res.status(acceso.codigo === 'red' ? 503 : 403).json(acceso);
  if (acceso.restantes <= 0) {
    return res.status(403).json({ ok: false, codigo: 'agotado', mensaje: `Ya has generado tus ${LIMITE} planes con este pedido.` });
  }

  const { datos, error } = limpiarRespuestas(req.body?.respuestas);
  if (error) return res.status(400).json({ ok: false, codigo: 'datos', mensaje: error });

  const [r, d] = await Promise.allSettled([
    pedirJSON(promptRutina(datos)).then((x) => { if (!Array.isArray(x?.dias)) throw new Error('Rutina incompleta'); return x; }),
    pedirJSON(promptDieta(datos)).then((x) => { if (!Array.isArray(x?.comidas)) throw new Error('Dieta incompleta'); return x; }),
  ]);

  if (r.status === 'rejected' && d.status === 'rejected') {
    console.error('Fallo de IA:', r.reason?.message, '|', d.reason?.message);
    return res.status(502).json({ ok: false, codigo: 'ia', mensaje: 'No se ha podido crear el plan ahora mismo. No se ha descontado ningún plan. Inténtalo otra vez.' });
  }

  const restantes = await sumarUso(acceso);
  return res.status(200).json({
    ok: true,
    restantes,
    rutina: r.status === 'fulfilled' ? r.value : { error: 'No se ha podido crear la rutina esta vez.' },
    dieta: d.status === 'fulfilled' ? d.value : { error: 'No se ha podido crear la dieta esta vez.' },
  });
}
