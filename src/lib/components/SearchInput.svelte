<script lang="ts">
  import { goto, afterNavigate } from "$app/navigation";
  import { findSuggestions, type WordSuggestion } from "$lib/db/repository";
  import { parseMarkdown } from "$lib/markdown";
  import { SearchIcon } from "@lucide/svelte";

  const SUGGESTION_LIMIT = 4;

  let query = $state("");
  let suggestions = $state<WordSuggestion[]>([]);
  let loading = $state(false);
  let isOpen = $state(false);
  let hasFocus = $state(false);

  let debounceId: ReturnType<typeof setTimeout> | null = null;
  let lastUrlQuery = "";

  const syncFromUrl = (url: URL | null) => {
    const value = url?.searchParams.get("q") ?? "";
    if (value !== lastUrlQuery) {
      lastUrlQuery = value;
      query = value;
    }
  };

  $effect(() => {
    if (typeof window !== "undefined") {
      syncFromUrl(new URL(window.location.href));

      afterNavigate(({ to }) => {
        const target = to?.url ?? new URL(window.location.href);
        syncFromUrl(target);
      });
    }

    return () => {
      if (debounceId) {
        clearTimeout(debounceId);
      }
    };
  });

  const scheduleSuggestions = (value: string) => {
    if (debounceId) {
      clearTimeout(debounceId);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      suggestions = [];
      loading = false;
      return;
    }

    loading = true;
    suggestions = [];

    debounceId = setTimeout(async () => {
      try {
        const result = await findSuggestions({
          term: trimmed,
          limit: SUGGESTION_LIMIT,
        });
        if (trimmed === query.trim()) {
          suggestions = result.slice(0, SUGGESTION_LIMIT);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
        suggestions = [];
      } finally {
        loading = false;
        if (!hasFocus) {
          isOpen = false;
        }
      }
    }, 200);
  };

  const updateSearch = (value: string) => {
    query = value;
    isOpen = value.trim().length > 0 && hasFocus;
    scheduleSuggestions(value);
  };

  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    updateSearch(target.value);
  };

  const navigateToSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return;
    }

    goto(`/?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (event: Event) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      return;
    }
    isOpen = false;
    navigateToSearch(term);
  };

  const handleFocus = () => {
    hasFocus = true;
    isOpen = query.trim().length > 0;
    if (isOpen && !suggestions.length) {
      scheduleSuggestions(query);
    }
  };

  const handleBlur = () => {
    hasFocus = false;
    setTimeout(() => {
      isOpen = false;
    }, 150);
  };

  const handleSelect = (suggestion: WordSuggestion) => {
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }
    query = suggestion.word;
    isOpen = false;
    goto(`/?word=${encodeURIComponent(suggestion.id)}&q=${encodeURIComponent(suggestion.word)}`);
  };
</script>

<form class="w-full md:flex-1" role="search" aria-label="Buscar palabras" onsubmit={handleSubmit}>
  <div class="dropdown w-full" class:dropdown-open={isOpen}>
    <label class="input input-bordered flex w-full items-center gap-2">
      <SearchIcon class="text-base-content/60 size-5" aria-hidden="true" />
      <input
        type="search"
        class="grow bg-transparent outline-none"
        placeholder="Buscar palabras..."
        autocomplete="off"
        bind:value={query}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
      />
      {#if loading}
        <span class="loading loading-spinner loading-xs text-primary" aria-hidden="true"></span>
      {/if}
    </label>

    {#if isOpen}
      <ul
        class="dropdown-content rounded-box bg-base-100 border-base-200 z-20 mt-2 flex max-h-72 w-full flex-col overflow-y-auto border shadow-lg"
        role="listbox"
      >
        {#if loading}
          <li class="text-base-content/70 px-4 py-3 text-sm">
            <span>Buscando...</span>
          </li>
        {:else if suggestions.length === 0}
          <li class="text-base-content/70 px-4 py-3 text-sm">
            <span>Sin resultados</span>
          </li>
        {:else}
          {#each suggestions as suggestion (suggestion.id)}
            <li>
              <button
                type="button"
                class="hover:bg-base-200 flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors"
                onclick={() => handleSelect(suggestion)}
                role="option"
                aria-selected="false"
              >
                <span class="font-semibold">{suggestion.word}</span>
                <span class="text-base-content/70 text-xs">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html parseMarkdown(suggestion.definition)}
                </span>
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    {/if}
  </div>
</form>
