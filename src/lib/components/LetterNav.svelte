<script lang="ts">
  import { browser } from "$app/environment";
  import { getLetterCounts, type LetterCount } from "$lib/db/repository";
  import initialWordsData from "$lib/data/initial-words.json";

  // The letter being browsed is marked as the current one; with none, "Todas" is.
  const { current = null } = $props<{ current?: string | null }>();

  // Counts computed at build time, so the row has its final size before the data loads;
  // replaced by the live counts once they are ready.
  let letterCounts = $state<LetterCount[]>(
    (initialWordsData as { letters?: LetterCount[] }).letters ?? []
  );

  let hasLoadedCounts = $state(false);

  // Load counts once in the browser
  $effect(() => {
    if (!browser || hasLoadedCounts) return;

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

  const getLetterUrl = (letter: string) => `/?letter=${encodeURIComponent(letter)}`;

  const letters = $derived(letterCounts.filter(({ letter }) => letter !== "Todas"));
</script>

<!-- Browse by first letter: one quiet row of letters; the counts are in each link's name. -->
<nav aria-label="Navegación por letras" class="min-h-8">
  <h2 class="sr-only">Palabras por letra</h2>
  {#if letters.length > 0}
    <ul class="-ml-2 flex flex-wrap gap-1">
      <li>
        <a
          href="/"
          aria-current={current ? undefined : "page"}
          class={[
            "rounded-field inline-flex h-8 items-center px-2 text-sm font-medium transition-colors duration-150",
            current
              ? "text-muted hover:bg-base-200 hover:text-base-content"
              : "bg-base-200 text-base-content",
          ]}
        >
          Todas
        </a>
      </li>
      {#each letters as { letter, count } (letter)}
        <li>
          <a
            href={getLetterUrl(letter)}
            title={`${count} palabra${count === 1 ? "" : "s"}`}
            aria-label={`${letter}, ${count} palabra${count === 1 ? "" : "s"}`}
            aria-current={current === letter ? "page" : undefined}
            class={[
              "rounded-field inline-flex size-8 items-center justify-center text-sm font-medium transition-colors duration-150",
              current === letter
                ? "bg-base-200 text-base-content"
                : "text-muted hover:bg-base-200 hover:text-base-content",
            ]}
          >
            {letter}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</nav>
