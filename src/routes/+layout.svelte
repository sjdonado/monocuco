<script lang="ts">
  import "../app.css";
  import { env } from "$env/dynamic/public";
  import logo from "$lib/assets/logo.webp";
  import { onMount } from "svelte";
  import { dev } from "$app/environment";
  import SearchInput from "$lib/components/SearchInput.svelte";
  import { APP_VERSION } from "$lib/config";

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
        void registration?.update();
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    void register();
  });
</script>

<svelte:head>
  {#if env.PUBLIC_MODE === "production"}
    <script
      defer
      src="https://umami.donado.co/script.js"
      data-website-id="1c0c2c7a-ae4f-4f41-9e8c-7de069c9e06c"
    ></script>
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
        rel="noreferrer">Español barranquillero</a
      >.
    </p>
    <p class="flex flex-wrap items-center justify-center gap-x-2">
      <span class="tabular-nums">v{APP_VERSION}</span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        <a href="/guidelines" class="link hover:text-primary inline-flex min-h-6 items-center"
          >Pautas de contenido</a
        >
      </span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        <a
          href="https://github.com/sjdonado/monocuco"
          target="_blank"
          rel="noreferrer"
          class="link hover:text-primary inline-flex min-h-6 items-center">Github</a
        >
      </span>
      <span class="whitespace-nowrap">
        <span aria-hidden="true">•</span>
        Desarrollado por
        <a
          href="https://sjdonado.com"
          target="_blank"
          rel="noreferrer"
          class="link hover:text-primary inline-flex min-h-6 items-center"
        >
          @sjdonado
        </a>
      </span>
    </p>
  </footer>
</div>
