<svelte:head>
  <title>Monocuco | Privacidad</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-2xl flex-col gap-8">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl font-semibold tracking-tight">Privacidad</h1>
    <p class="text-muted">
      Monocuco no recopila datos sobre ti. No tiene cuentas, formularios de registro, publicidad ni
      estadísticas de visitas, no pone cookies y no carga herramientas de seguimiento. Esta página
      explica qué pasa con la información cuando visitas el sitio.
    </p>
  </header>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Búsquedas</h2>
    <p>
      El buscador funciona dentro de tu navegador con una copia del diccionario: mientras escribes,
      las sugerencias y los resultados se calculan sin enviar el texto a ningún servidor. Al buscar,
      la búsqueda pasa a la dirección de la página, por ejemplo /?q=carnaval. Si abres esa dirección
      directamente, o una con una palabra, el servidor la recibe para entregar la página, como
      cualquier otra, y Monocuco no la guarda.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Alojamiento</h2>
    <p>
      El sitio está alojado en <a
        class="link hover:text-primary"
        href="https://www.cloudflare.com/privacypolicy/"
        target="_blank"
        rel="noreferrer">Cloudflare</a
      >, que recibe cada solicitud antes que el sitio, incluida tu dirección IP, para entregar las
      páginas y protegerlas de abusos; para eso puede poner sus propias cookies técnicas de
      seguridad. Cloudflare trata esa información según su propia política de privacidad; Monocuco
      no lleva registros propios de visitas.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Almacenamiento en tu navegador</h2>
    <p>
      Para funcionar sin conexión, el sitio guarda en la caché de tu navegador sus archivos, el
      diccionario y las páginas que abres, incluida la búsqueda o la palabra de su dirección. Esa
      copia se queda en tu dispositivo, nunca se envía a ningún servidor, y puedes borrarla en
      cualquier momento desde la configuración del navegador.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Preguntas</h2>
    <p>
      Si tienes preguntas sobre esta página, escríbenos en
      <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco/issues"
        target="_blank"
        rel="noreferrer">GitHub Issues</a
      >.
    </p>
  </section>
</article>
