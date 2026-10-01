<svelte:head>
  <title>Monocuco | Contacto</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-2xl flex-col gap-8">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl font-semibold tracking-tight">Contacto</h1>
    <p class="text-muted">
      Monocuco es un proyecto comunitario sin oficina ni equipo de soporte. Toda la conversación
      sucede en público, en el repositorio del proyecto, para que cualquiera pueda ver y seguir cada
      propuesta.
    </p>
  </header>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Corregir o reportar una palabra</h2>
    <p>
      Si una definición está equivocada, es ofensiva o contiene información personal, abre un
      reporte en <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco/issues"
        target="_blank"
        rel="noreferrer">GitHub Issues</a
      >
      con el nombre de la palabra y el enlace a su página. Revisamos los reportes con las
      <a class="link hover:text-primary" href="/guidelines">pautas de contenido</a> y retiramos lo que
      no las cumple.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Proponer una palabra</h2>
    <p>
      Las palabras nuevas se proponen con una solicitud de cambios en
      <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco"
        target="_blank"
        rel="noreferrer">el repositorio</a
      >. El README explica cómo agregarla con un comando y abrir la solicitud. Si no usas GitHub,
      escribe la palabra, su definición y un ejemplo en un reporte y alguien del proyecto la
      agregará.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Hablar con quien mantiene el sitio</h2>
    <p>
      Monocuco lo mantiene <a
        class="link hover:text-primary"
        href="https://sjdonado.com"
        target="_blank"
        rel="noreferrer">@sjdonado</a
      >. Para temas que no son de una palabra, como errores del sitio o el uso de la API, también
      puedes abrir un reporte en GitHub.
    </p>
  </section>
</article>
