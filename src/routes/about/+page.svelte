<svelte:head>
  <title>Monocuco | Acerca de</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-2xl flex-col gap-8">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl font-semibold tracking-tight">Acerca de Monocuco</h1>
    <p class="text-muted">
      Monocuco es un diccionario abierto y gratuito del español barranquillero: las palabras y
      expresiones de Barranquilla y la costa Caribe de Colombia, cada una con su definición y el
      nombre de quien la aportó, muchas con un ejemplo. Es un proyecto comunitario de software
      libre, con licencia MIT, inspirado en
      <a
        class="link hover:text-primary"
        href="https://www.urbandictionary.com/"
        target="_blank"
        rel="noreferrer">Urban Dictionary</a
      >.
    </p>
  </header>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">De dónde vienen las palabras</h2>
    <p>
      La mayoría de las definiciones provienen de dos trabajos que reconocemos con gratitud:
      <a
        class="link hover:text-primary"
        href="https://sites.google.com/site/jdvillalobos/barranquillerismos"
        target="_blank"
        rel="noreferrer">El español hablado en Barranquilla</a
      >, de José David Villalobos, y
      <a
        class="link hover:text-primary"
        href="https://rafaelvega.com/significado-de-palabras-costenas/"
        target="_blank"
        rel="noreferrer">Significado de palabras costeñas</a
      >, de Rafael Vega. El resto lo aportan personas que proponen palabras nuevas.
    </p>
  </section>

  <section id="pautas" class="flex scroll-mt-20 flex-col gap-3">
    <h2 class="text-lg font-semibold">Pautas de contenido</h2>
    <p>Cualquiera puede proponer palabras. Para que el diccionario sea útil y seguro:</p>
    <ul class="list-disc space-y-2 pl-6">
      <li>
        Escribe para alguien que nunca ha estado en Barranquilla: qué significa la palabra, cuándo
        se usa y, si puedes, un ejemplo.
      </li>
      <li>
        Las definiciones ingeniosas y las expresiones de la calle, la música o el día a día son
        bienvenidas.
      </li>
      <li>
        No publiques información personal: nombres completos, direcciones, teléfonos, usuarios de
        redes ni nada que sirva para identificar o acosar a alguien.
      </li>
      <li>
        Puedes definir una palabra ofensiva para explicar su significado, nunca para promover el
        odio, discriminar o incitar a la violencia.
      </li>
    </ul>
  </section>

  <section id="contacto" class="flex scroll-mt-20 flex-col gap-3">
    <h2 class="text-lg font-semibold">Proponer, corregir o reportar</h2>
    <p>
      Las palabras nuevas se agregan con un comando del repositorio y una solicitud de cambios (pull
      request) en
      <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco#cómo-contribuir"
        target="_blank"
        rel="noreferrer">GitHub</a
      >; el README explica cada paso. Para reportar una definición equivocada, ofensiva o con datos
      personales, o un error del sitio, abre un reporte en
      <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco/issues"
        target="_blank"
        rel="noreferrer">GitHub Issues</a
      >
      con el enlace a la página. Si prefieres no usar GitHub, escribe a
      <a class="link hover:text-primary" href="mailto:cedar.onyxes0q@icloud.com">este correo</a>;
      para proponer una palabra, incluye su definición y un ejemplo. Retiramos lo que no cumple
      estas pautas.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Cómo funciona</h2>
    <p>
      El buscador corre en tu navegador: el diccionario se descarga la primera vez que lo necesitas
      y, mientras escribes, nada se envía a ningún servidor. Desde entonces la búsqueda también
      funciona sin conexión. Para programas y asistentes hay una
      <a class="link hover:text-primary" href="/openapi.json">API de solo lectura</a> y una
      <a class="link hover:text-primary" href="/llms.txt">guía para agentes</a>.
    </p>
  </section>

  <section class="text-muted text-sm">
    <p>
      Desarrollado por
      <a
        class="link hover:text-primary"
        href="https://sjdonado.com"
        target="_blank"
        rel="noreferrer">@sjdonado</a
      >.
    </p>
  </section>
</article>
