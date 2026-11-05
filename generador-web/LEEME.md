# Generador Sin Límites — versión pública (Shopify)

Web donde tus compradores entran con **el email de su compra y su número de pedido de Shopify** y generan su rutina y su dieta con IA. Cada pedido permite **5 planes** (se cambia con `LIMITE_PLANES`).

## Cómo funciona

1. El cliente compra «Entrena Sin Límites» en tu tienda Shopify.
2. Recibe el email de confirmación con su número de pedido, el PDF y el enlace al generador.
3. Entra en `app.tudominio.es` con su email y su número de pedido.
4. El servidor comprueba en tu Shopify que el pedido existe, es de ese email, incluye el producto, está pagado y no está cancelado ni reembolsado.
5. Cada plan creado se apunta en el propio pedido (metacampo `sinlimites.planes_usados`). Puedes verlo y cambiarlo en el pedido, dentro de tu admin de Shopify.

Solo se descuenta un plan cuando la IA llega a crearlo. Si falla, el comprador no pierde nada.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
| --- | --- |
| `public/index.html` | La web: acceso, cuestionario de 8 pasos y plan |
| `api/acceso.js` | Comprueba la compra sin gastar planes |
| `api/plan.js` | Comprueba la compra, crea rutina y dieta con la IA y descuenta 1 plan |
| `lib/prompts.js` | Las instrucciones que recibe la IA (se quedan en el servidor) |
| `lib/shopify.js` | Conexión con tu tienda Shopify |
| `lib/ia.js` | Conexión con la IA de Anthropic |
| `.env.example` | Las claves que tienes que configurar |

## Paso 1 — El producto en Shopify

1. Pasa tu tienda a un plan de pago (Settings → Plan). Sin eso no puedes vender.
2. Crea el producto «Entrena Sin Límites» a 9,99 €, con el PDF como archivo descargable (app Digital Products de Shopify).
3. Abre el producto en tu admin: el número al final de la dirección (`.../products/123456789`) es tu `SHOPIFY_PRODUCT_ID`.
4. En Settings → Notifications → Order confirmation, añade el enlace al generador (ver el bloque al final de este archivo).

## Paso 2 — La app para que el generador lea tus pedidos

Shopify ya no permite crear «apps personalizadas» desde el admin; se hacen en el Dev Dashboard.

1. Entra en dev.shopify.com, ve a **Dev Dashboard** y crea una app nueva (por ejemplo, «Generador Sin Límites»).
2. En **Versions**, configura los permisos (scopes) del Admin API: `read_orders`, `write_orders` y `read_products`. Si te deja, añade también `read_all_orders` (ver nota abajo). Publica la versión (Release).
3. En **Home**, instala la app en tu tienda.
4. En **Settings**, copia el **Client ID** y el **Client Secret**. Son tu `SHOPIFY_CLIENT_ID` y tu `SHOPIFY_CLIENT_SECRET`.

El generador pide solo el token de acceso a Shopify y lo renueva cada 24 horas.

**Nota sobre pedidos antiguos:** con `read_orders`, Shopify solo deja leer los pedidos de los últimos 60 días. Si no consigues `read_all_orders`, tus clientes podrán usar el generador durante 60 días desde su compra. Si eso te importa, solicita `read_all_orders` para la app.

## Paso 3 — Clave de la IA

1. Entra en console.anthropic.com y crea una cuenta.
2. Añade saldo y **pon un límite de gasto mensual**.
3. En **API Keys**, crea una clave. Es tu `ANTHROPIC_API_KEY`. No la compartas ni la pongas en la web.

Cada plan hace 2 llamadas a la IA (rutina y dieta). Mira el coste por uso en la página de precios de Anthropic para calcular tu margen.

## Paso 4 — Subir el generador a Vercel

1. Crea una cuenta en vercel.com.
2. Sube esta carpeta: crea un repositorio en GitHub con estos archivos e impórtalo desde Vercel (**Add New → Project**).
3. En **Environment Variables**, añade todas las de `.env.example`:
   `ANTHROPIC_API_KEY`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_PRODUCT_ID`, `LIMITE_PLANES`.
4. Pulsa **Deploy**.

El plan gratuito de Vercel (Hobby) está pensado para uso personal. Para vender, revisa sus condiciones; lo normal es pasar al plan Pro.

## Paso 5 — Tu dominio

Si compras el dominio en Shopify (por ejemplo `entrenasinlimites.es`), la tienda se queda en el dominio principal y el generador en `app.entrenasinlimites.es`:

1. En Vercel → tu proyecto → **Settings → Domains**, añade `app.entrenasinlimites.es`. Vercel te dirá qué registro DNS crear (normalmente un **CNAME** llamado `app`).
2. En Shopify → **Settings → Domains**, abre tu dominio → **DNS settings** → **Add custom record** y crea ese CNAME con el valor que te dio Vercel.
3. En unos minutos (a veces unas horas) `app.entrenasinlimites.es` mostrará el generador.

## Paso 6 — Probarlo antes de lanzar

1. En Shopify, crea un código de descuento del 100 % y compra tu propio producto.
2. Entra en `app.tudominio.es` con tu email y el número de ese pedido, y genera un plan.
3. En el pedido, en tu admin de Shopify, verás el metacampo `planes_usados` con valor 1.
4. Borra el código de descuento.

Si un cliente necesita más planes, cambia el valor de `planes_usados` en su pedido.

## Bloque para el email de confirmación

En Shopify → **Settings → Notifications → Order confirmation → Edit code**, pega esto justo después del saludo inicial:

```liquid
{% for line in line_items %}
  {% if line.product.title contains "Sin Límites" %}
  <table class="row"><tr><td>
    <p style="font-size:16px;line-height:1.5;margin:16px 0">
      <strong>Tu generador ya está listo.</strong><br>
      Entra en <a href="https://app.TUDOMINIO.es">app.TUDOMINIO.es</a> con este email y tu número de pedido: <strong>{{ order_name | remove: '#' }}</strong>
    </p>
  </td></tr></table>
  {% break %}
  {% endif %}
{% endfor %}
```

Cambia `TUDOMINIO.es` por tu dominio.

## Cambiar cosas

- **Planes por compra:** cambia `LIMITE_PLANES` en Vercel y vuelve a desplegar.
- **Modelo de IA:** añade `ANTHROPIC_MODEL` en Vercel (por defecto `claude-sonnet-5-5`).
- **Textos de la web:** edita `public/index.html`.
- **Enlaces legales del pie:** cambia los `href="#"` de Aviso legal y Privacidad por tus páginas.
