<script lang="ts">
  import { browser } from "$app/environment";
  import { getLetterCounts, type LetterCount } from "$lib/db/repository";
  import { searchFailed } from "$lib/stores/search-status";

  let letterCounts = $state<LetterCount[]>([]);

  let isSearchFailed = $state(false);
  let hasLoadedCounts = $state(false);

  $effect(() => {
    const unsubFailed = searchFailed.subscribe((v) => (isSearchFailed = v));
    return () => {
      unsubFailed();
    };
  });

  // Load counts once in the browser
  $effect(() => {
    if (!browser || isSearchFailed || hasLoadedCounts) return;

    const loadCounts = async () => {
      try {
        const counts = await getLetterCounts();
        letterCounts = counts;
        hasLoadedCounts = true;
      } catch (error) {
        console.error("Failed to load letter counts", error);
        hasLoadedCounts = true;
      }
    };

    void loadCounts();
  });

  $effect(() => {
    if (!isSearchFailed) return;
    letterCounts = [];
  });

  const getSearchUrl = (letter: string) => {
    if (letter === "Todas") {
      return "/";
    }
    return `/?q=${encodeURIComponent(letter)}`;
  };
</script>

<nav aria-label="Navegación por letras">
  <h2 class="text-base-content/70 mb-3 text-sm font-semibold">Palabras por letra</h2>
  {#if isSearchFailed}
    <p class="text-base-content/70 text-sm">Búsqueda no disponible por ahora.</p>
  {:else if letterCounts.length > 0}
    <ul class="space-y-1 text-sm">
      {#each letterCounts as { letter, count } (letter)}
        <li>
          <a href={getSearchUrl(letter)} class="flex justify-between p-0">
            <span class="link link-primary" class:font-bold={letter === "Todas"}>{letter}</span>
            <span class="text-base-content/60">{count}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</nav>
