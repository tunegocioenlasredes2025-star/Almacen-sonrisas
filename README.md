# El Almacén de Sonrisas — sitio web

Landing de una página para **El Almacén de Sonrisas**, cotillón, repostería y librería en
La Perlita, Moreno (@elalmacendesonrisas). HTML, CSS y JS sin frameworks, lista para Vercel.

## Estructura

```
index.html            la página
css/styles.css        estilos (mobile first)
js/main.js            WhatsApp, menú, abierto/cerrado, lista de compras, animaciones
assets/img/           logo + fotos en webp
assets/favicon/       íconos
favicon.ico, site.webmanifest, robots.txt, sitemap.xml, vercel.json
insumos/              material fuente y ANALISIS.md (no se indexa)
```

## Lo que tiene

- **Estado en vivo**: la barra de arriba dice "Abierto ahora" o "Cerrado · abre a las…" con la hora de
  Argentina, y la tabla de horarios marca el día de hoy.
- **Armá tu lista**: el cliente tilda productos de las tres góndolas, suma temática, invitados, fecha y
  si retira o quiere envío, y manda todo armado por WhatsApp. La lista queda guardada en el navegador.
- Todos los botones de WhatsApp salen con un mensaje distinto según desde dónde se tocan.
- SEO local: title y description con Moreno y La Perlita, schema `Store` con horarios y coordenadas,
  schema `FAQPage`, Open Graph, sitemap y robots.

## Panel de administración (`/admin`)

El catálogo de la web sale de `data/catalogo.json`. Desde `/admin` se cargan, editan, ordenan y
borran productos, con foto, rubro, precio opcional, etiqueta (oferta, nuevo, de temporada), stock y
destacado. También se prende o apaga "Mostrar precios en la web".

**Cómo guarda:** no hay base de datos. "Publicar cambios" hace un commit en este mismo repo (el
catálogo más las fotos nuevas, achicadas a 1000 px en webp) y Vercel republica la web sola en 1 o 2
minutos. Cada publicación queda en el historial de GitHub, así que cualquier cambio se puede deshacer.
Las fotos que ningún producto usa se borran solas de `assets/catalogo/`.

**Acceso:** el panel pide un token de GitHub de acceso fino (fine-grained):
1. <https://github.com/settings/personal-access-tokens/new> con la cuenta dueña del repo.
2. Repository access → *Only select repositories* → **Almacen-sonrisas**.
3. Permissions → Repository permissions → **Contents: Read and write**. Nada más.
4. Duración: la más larga disponible. Cuando vence, se genera otro y se vuelve a pegar.

El token queda guardado solo en el navegador de quien lo pega (nunca en el código). Sin token,
`/admin` no puede leer ni escribir nada. Si se filtra, se revoca desde la misma página de GitHub.

Si la cuenta de GitHub, el repo o la rama cambian, editar `CFG` al principio de `admin/admin.js`.

**Borrador:** los cambios sin publicar quedan guardados en el navegador. Si se cierra la pestaña,
al volver el panel ofrece recuperarlos.

## Referencias de diseño

Se analizaron Meri Meri, Fancy Sprinkles y Oh Happy Day antes de diseñar. El detalle de qué se tomó
de cada una está en `insumos/ANALISIS.md`.

## Pendientes antes de publicar

1. **Confirmar el WhatsApp.** Se usó el 11 5666-9809 de la bio de Instagram. En Maps figura otro
   teléfono (11 2877-5431), que quedó como "Llamar". Si el WhatsApp es otro, cambiar `WA` en
   `js/main.js` y el texto del footer.
2. **Confirmar el horario de la tarde.** Maps dice 17 a 20; el cartel de la puerta dice 16:30 a 20.
   Se usó el de Maps. Si cambia, editar `TURNOS` en `js/main.js`, la tabla de `#visitanos`, el footer,
   la FAQ y el schema.
3. **Dirección**: IG dice Marcos del Bueno 497, Maps dice 495. Se usó 497.
4. **Fotos**: hay solo 4 fotos propias (fachada, budineras, heladera, toppers). Pedir 8 a 10 fotos del
   interior y de productos para reemplazar y sumar.
5. **Imagen para compartir** (`assets/img/og.jpg`): generada a partir del hero.
6. **Dominio**: las URLs absolutas (canonical, OG, schema, sitemap, robots) apuntan a
   `https://almacen-sonrisas.vercel.app/`. Si se compra dominio, reemplazarlas todas.

## Deploy

Subir la carpeta a un repo de GitHub e importarlo en Vercel como proyecto estático (sin build).
