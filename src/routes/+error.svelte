<script lang="ts">
  import { page } from "$app/state";

  // Old bookmarks to the removed submission form get a pointer to how words are added now.
  const isOldForm = $derived.by(() => {
    // Typed routes do not include /add any more, which is the point: compare as a string.
    const path: string = page.url.pathname;
    return path === "/add" || path.startsWith("/add/");
  });
</script>

<svelte:head>
  <title>Monocuco | {page.status === 404 ? "Página no encontrada" : "Error"}</title>
</svelte:head>

<!-- Unknown paths land here instead of the framework's page. -->
<section class="flex flex-col items-center gap-3 py-16 text-center">
  <p class="text-muted text-sm tabular-nums">{page.status}</p>
  <h1 class="text-2xl font-semibold tracking-tight">
    {page.status === 404 ? "Página no encontrada" : "Algo salió mal"}
  </h1>
  {#if isOldForm}
    <p class="text-muted max-w-sm">
      Ya no recibimos palabras desde la web. Consulta
      <a href="/about#contacto" class="link hover:text-primary">cómo proponer una palabra</a>.
    </p>
  {/if}
  <a href="/" class="btn btn-primary mt-3">Volver al inicio</a>
</section>
