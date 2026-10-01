<svelte:head>
  <title>Monocuco | Acerca de</title>
</svelte:head>

<article class="mx-auto flex w-full max-w-2xl flex-col gap-8">
  <header class="flex flex-col gap-3">
    <h1 class="text-2xl font-semibold tracking-tight">Acerca de Monocuco</h1>
    <p class="text-muted">
      Monocuco es un diccionario abierto y gratuito del español barranquillero: las palabras y
      expresiones que se hablan en Barranquilla y la costa Caribe de Colombia, cada una con su
      definición, muchas con un ejemplo de uso y el nombre de quien la aportó.
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
      >, de Rafael Vega. El resto llega de personas que proponen palabras nuevas. Cada entrada
      muestra quién la aportó y cuándo.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Un proyecto abierto</h2>
    <p>
      Monocuco nació en 2020 como un proyecto de software libre, con licencia MIT. El código y los
      datos están en <a
        class="link hover:text-primary"
        href="https://github.com/sjdonado/monocuco"
        target="_blank"
        rel="noreferrer">GitHub</a
      >. Las palabras nuevas se proponen con una solicitud de cambios (pull request), y antes de
      publicarse se revisan con las
      <a class="link hover:text-primary" href="/guidelines">pautas de contenido</a>. El sitio lo
      mantiene
      <a
        class="link hover:text-primary"
        href="https://sjdonado.com"
        target="_blank"
        rel="noreferrer">@sjdonado</a
      >
      junto con las personas que contribuyen.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-lg font-semibold">Cómo funciona</h2>
    <p>
      El buscador corre en tu navegador: al abrir el sitio se descarga el diccionario completo y,
      mientras escribes, las sugerencias y los resultados se calculan sin enviar el texto a ningún
      servidor. Por eso también funciona sin conexión después de la primera visita. Para programas y
      asistentes hay una
      <a class="link hover:text-primary" href="/openapi.json">API de solo lectura</a> y una
      <a class="link hover:text-primary" href="/llms.txt">guía para agentes</a>.
    </p>
  </section>
</article>
