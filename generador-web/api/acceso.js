// POST /api/acceso  { email, pedido }  →  comprueba la compra sin gastar ningún plan.
import { comprobarPedido, LIMITE } from '../lib/shopify.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, mensaje: 'Método no permitido.' });
  const r = await comprobarPedido(req.body?.email, req.body?.pedido);
  if (!r.ok) return res.status(r.codigo === 'red' ? 503 : 403).json(r);
  return res.status(200).json({ ok: true, restantes: r.restantes, limite: LIMITE });
}
