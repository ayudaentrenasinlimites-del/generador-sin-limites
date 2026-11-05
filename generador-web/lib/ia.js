// Llama a la API de Anthropic y devuelve el JSON que pide el prompt.

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export async function pedirJSON(prompt, { maxTokens = 8000 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Falta configurar ANTHROPIC_API_KEY en el servidor.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`La IA respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }
  const data = await res.json();
  const texto = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extraerJSON(texto);
}

export function extraerJSON(texto) {
  const t = String(texto || '').trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  throw new Error('La IA no devolvió un JSON válido.');
}
