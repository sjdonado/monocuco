<script lang="ts">
  import { browser } from "$app/environment";
  import { getLetterCounts, type LetterCount } from "$lib/db/repository";
  import { dbReady } from "$lib/stores/db-ready";

  let letterCounts = $state<LetterCount[]>([]);
  let loading = $state(true);

  // Track DB readiness
  let isDbReady = $state(false);

  $effect(() => {
    const unsubReady = dbReady.subscribe((v) => (isDbReady = v));
    return () => {
      unsubReady();
    };
  });

  // Only load when DB is ready
  $effect(() => {
    if (!browser || !isDbReady) return;

    const loadCounts = async () => {
      try {
        const counts = await getLetterCounts();
        letterCounts = counts;
      } catch (error) {
        console.error("Failed to load letter counts", error);
      } finally {
        loading = false;
      }
    };

    void loadCounts();
  });

  const getSearchUrl = (letter: string) => {
    if (letter === "Todas") {
      return "/";
    }
    return `/?q=${encodeURIComponent(letter)}`;
  };

  // Skeleton items for loading state
  const SKELETON_ITEMS = Array.from({ length: 12 }, (_, i) => i);
</script>

<nav aria-label="Navegación por letras">
  <h2 class="text-base-content/70 mb-3 text-sm font-semibold">Palabras por letra</h2>
  {#if loading || !isDbReady}
    <!-- Skeleton loading state -->
    <ul class="space-y-1 text-sm">
      {#each SKELETON_ITEMS as i (i)}
        <li class="flex justify-between p-0">
          <span class="skeleton h-4 w-16"></span>
          <span class="skeleton h-4 w-8"></span>
        </li>
      {/each}
    </ul>
  {:else}
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
