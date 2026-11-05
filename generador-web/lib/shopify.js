// Comprueba pedidos de tu tienda Shopify y lleva la cuenta de planes usados.
// El acceso es: email de compra + número de pedido. Cada pedido permite LIMITE_PLANES planes.
// Los planes usados se guardan en el propio pedido (metacampo sinlimites.planes_usados).

export const LIMITE = Number(process.env.LIMITE_PLANES || 5);
const API = '2026-07';
const NS = 'sinlimites', KEY = 'planes_usados';

let tokenCache = { token: '', caduca: 0 };

function tienda() {
  const t = String(process.env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(t)) throw new Error('SHOPIFY_STORE_DOMAIN debe ser algo como tu-tienda.myshopify.com');
  return t;
}

// Los tokens de las apps del Dev Dashboard caducan a las 24 h: se piden con client credentials y se guardan en memoria.
async function token() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (tokenCache.token && Date.now() < tokenCache.caduca) return tokenCache.token;
  const res = await fetch(`https://${tienda()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID || '',
      client_secret: process.env.SHOPIFY_CLIENT_SECRET || '',
    }),
  });
  if (!res.ok) throw new Error(`No se pudo obtener el token de Shopify (${res.status})`);
  const j = await res.json();
  const vida = Number(j.expires_in || 86399) * 1000;
  tokenCache = { token: j.access_token, caduca: Date.now() + vida - 5 * 60 * 1000 };
  return tokenCache.token;
}

async function gql(query, variables) {
  const res = await fetch(`https://${tienda()}/admin/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': await token() },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify respondió ${res.status}`);
  const j = await res.json();
  if (j.errors) throw new Error('Shopify: ' + JSON.stringify(j.errors).slice(0, 300));
  return j.data;
}

const productoValido = (gid) => {
  const p = String(process.env.SHOPIFY_PRODUCT_ID || '').trim();
  if (!p) return true; // sin configurar: vale cualquier pedido de la tienda
  const id = p.replace(/\D/g, '');
  return String(gid || '').endsWith('/' + id);
};

const limpiaPedido = (v) => String(v || '').replace(/[^0-9]/g, '').slice(0, 12);
const limpiaEmail = (v) => String(v || '').trim().toLowerCase().slice(0, 200);

const Q_PEDIDO = `query($q: String!) {
  orders(first: 5, query: $q) {
    nodes {
      id name email cancelledAt test displayFinancialStatus
      customer { defaultEmailAddress { emailAddress } }
      lineItems(first: 50) { nodes { product { id } } }
      metafield(namespace: "${NS}", key: "${KEY}") { value }
    }
  }
}`;

export async function comprobarPedido(emailIn, pedidoIn) {
  const email = limpiaEmail(emailIn), num = limpiaPedido(pedidoIn);
  if (!email.includes('@') || !num) {
    return { ok: false, codigo: 'formato', mensaje: 'Escribe el email con el que compraste y tu número de pedido (por ejemplo, 1001).' };
  }
  let data;
  try {
    data = await gql(Q_PEDIDO, { q: `name:#${num}` });
  } catch (e) {
    console.error(e.message);
    return { ok: false, codigo: 'red', mensaje: 'No se ha podido comprobar tu pedido ahora mismo. Inténtalo en unos minutos.' };
  }
  const pedido = (data?.orders?.nodes || []).find((o) => {
    const mails = [o.email, o.customer?.defaultEmailAddress?.emailAddress].filter(Boolean).map((m) => m.toLowerCase());
    return o.name.replace(/\D/g, '') === num && mails.includes(email);
  });
  const fallo = { ok: false, codigo: 'no_existe', mensaje: 'No encontramos un pedido con ese email y ese número. Revisa el email de confirmación de tu compra.' };
  if (!pedido) return fallo;
  if (!pedido.lineItems.nodes.some((li) => productoValido(li.product?.id))) return fallo;
  if (pedido.cancelledAt) return { ok: false, codigo: 'cancelado', mensaje: 'Este pedido está cancelado y ya no da acceso.' };
  const estado = pedido.displayFinancialStatus;
  if (estado === 'REFUNDED' || estado === 'VOIDED') return { ok: false, codigo: 'reembolsado', mensaje: 'Este pedido fue reembolsado y ya no da acceso.' };
  if (estado !== 'PAID' && estado !== 'PARTIALLY_REFUNDED') return { ok: false, codigo: 'pendiente', mensaje: 'Tu pago todavía no está confirmado. Inténtalo de nuevo en unos minutos.' };

  const usos = Number(pedido.metafield?.value || 0);
  return { ok: true, id: pedido.id, usos, restantes: Math.max(0, LIMITE - usos) };
}

const M_USOS = `mutation($m: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $m) { userErrors { field message } }
}`;

export async function sumarUso(pedido) {
  const nuevo = pedido.usos + 1;
  try {
    const d = await gql(M_USOS, { m: [{ ownerId: pedido.id, namespace: NS, key: KEY, type: 'number_integer', value: String(nuevo) }] });
    const errs = d?.metafieldsSet?.userErrors || [];
    if (errs.length) console.error('metafieldsSet:', JSON.stringify(errs));
  } catch (e) {
    console.error('No se pudo guardar el uso:', e.message);
  }
  return Math.max(0, LIMITE - nuevo);
}
