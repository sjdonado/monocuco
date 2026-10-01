<script lang="ts">
  import "../app.css";
  import logo from "$lib/assets/logo.webp";
  import { onMount } from "svelte";
  import { dev } from "$app/environment";
  import SearchInput from "$lib/components/SearchInput.svelte";
  import { APP_VERSION } from "$lib/config";
  import { page } from "$app/state";
  import { SITE_DESCRIPTION, SITE_URL, canonicalPath } from "$lib/site";

  const canonical = $derived(`${SITE_URL}${canonicalPath(page.url)}`);
  // A link to a missing word is answered with a 404 after rendering (src/hooks.server.ts).
  // `ssr` describes only the URL the visitor opened, so it counts only while that is the URL.
  const missingWord = $derived(
    // `word === null` first: prerendered pages have no `ssr` and may not read the query.
    page.data.ssr?.word === null && page.data.ssr.search === page.url.search
  );

  const { children } = $props();

  onMount(() => {
    if (dev || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          type: "module",
        });
        // Immediately check for updates. Browsers that block service workers can resolve
        // without a registration.
        // Offline, the update check cannot reach the network; the cached worker keeps serving.
        registration?.update().catch(() => {});
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    void register();
  });
</script>

<svelte:head>
  <!-- An error page has no address of its own to keep. -->
  {#if page.status < 400 && !missingWord}
    <link rel="canonical" href={canonical} />
  {/if}
  <meta property="og:url" content={canonical} />
  <!-- The home page writes its own description: it changes with the word or letter shown. -->
  {#if page.route.id !== "/"}
    <meta name="description" content={SITE_DESCRIPTION} />
  {/if}
</svelte:head>

<div class="flex min-h-dvh flex-col">
  <header class="border-hairline bg-base-100 sticky top-0 z-50 border-b">
    <div class="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3">
      <a href="/" class="flex shrink-0 items-center gap-2" aria-label="Monocuco, inicio">
        <img class="h-8 w-auto" src={logo} alt="" fetchpriority="high" decoding="async" />
        <span class="hidden text-lg font-semibold tracking-tight sm:inline">Monocuco</span>
      </a>
      <div class="min-w-0 flex-1">
        <SearchInput />
      </div>
    </div>
  </header>
  <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
    {@render children()}
  </main>
  <footer class="text-muted flex flex-col items-center gap-2 px-4 py-8 text-center text-xs">
    <p>
      Diccionario abierto y gratuito de
      <a
        class="link hover:text-primary"
        href="https://es.wikipedia.org/wiki/Español_barranquillero"
        target="_blank"
        rel="noreferrer">español barranquillero</a
      >.
    </p>
    <p class="flex flex-wrap items-center justify-center gap-x-2">
      <span class="tabular-nums">v{APP_VERSION}</span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        <a href="/about" class="link hover:text-primary inline-flex min-h-6 items-center"
          >Acerca de</a
        >
      </span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        <a href="/privacy" class="link hover:text-primary inline-flex min-h-6 items-center"
          >Privacidad</a
        >
      </span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        <a
          href="https://github.com/sjdonado/monocuco"
          target="_blank"
          rel="noreferrer"
          class="link hover:text-primary inline-flex min-h-6 items-center">Código fuente</a
        >
      </span>
    </p>
  </footer>
</div>
