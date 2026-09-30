<script lang="ts">
  import { goto, afterNavigate } from "$app/navigation";
  import { findSuggestions, type WordSuggestion } from "$lib/db/repository";
  import { parseMarkdown } from "$lib/markdown";
  import { SearchIcon } from "@lucide/svelte";
  import { searchFailed } from "$lib/stores/search-status";

  const SUGGESTION_LIMIT = 5;
  const LISTBOX_ID = "search-suggestions";

  // Index of the suggestion highlighted with the arrow keys, -1 for none.
  let activeIndex = $state(-1);
  let lookupFailed = $state(false);
  let lookupToken = 0;

  // Closing the list also forgets the highlight, so reopening never preselects a word.
  const close = () => {
    isOpen = false;
    activeIndex = -1;
  };

  let query = $state("");
  let suggestions = $state<WordSuggestion[]>([]);
  let loading = $state(false);
  let isOpen = $state(false);
  let hasFocus = $state(false);

  // Track search data readiness
  let isSearchFailed = $state(false);

  $effect(() => {
    const unsubFailed = searchFailed.subscribe((v) => (isSearchFailed = v));
    return () => {
      unsubFailed();
    };
  });

  // Disable search if search data failed to load
  const isDisabled = $derived(isSearchFailed);

  $effect(() => {
    if (!isSearchFailed) return;
    suggestions = [];
    loading = false;
    close();
    ++lookupToken;
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }
  });

  let debounceId: ReturnType<typeof setTimeout> | null = null;
  let lastUrlQuery = "";

  // The field follows the URL on Back, Forward and links. A URL that only lost surrounding
  // spaces is the same search, so it never overwrites what the visitor is typing.
  const syncFromUrl = (url: URL | null) => {
    const value = url?.searchParams.get("q") ?? "";
    if (value.trim() === lastUrlQuery.trim()) return;
    lastUrlQuery = value;
    query = value;
    // Suggestions belong to the previous term: drop them and any lookup still running.
    suggestions = [];
    close();
    ++lookupToken;
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
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
    lookupFailed = false;
    suggestions = [];
    activeIndex = -1;

    // Only the latest lookup may end the pending state; an older one finishing late
    // would otherwise show "Sin resultados" while the newer one still runs.
    const request = ++lookupToken;
    debounceId = setTimeout(async () => {
      try {
        const result = await findSuggestions({
          term: trimmed,
          limit: SUGGESTION_LIMIT,
        });
        if (request === lookupToken && trimmed === query.trim()) {
          suggestions = result.slice(0, SUGGESTION_LIMIT);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
        if (request === lookupToken) {
          suggestions = [];
          lookupFailed = true;
        }
      } finally {
        if (request === lookupToken) {
          loading = false;
          if (!hasFocus) close();
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
    close();
    // Submitting an empty field clears a search (or a word opened from one): back to all
    // words. On a letter or page, where nothing was searched, it does nothing.
    if (!term) {
      const url = new URL(window.location.href);
      if (url.searchParams.get("q") || url.searchParams.get("word")) goto("/");
      return;
    }
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
      if (!hasFocus) close();
    }, 150);
  };

  // Combobox keys: Down and Up move through the suggestions, Enter opens the highlighted
  // word (or searches when none is highlighted), Escape closes the list.
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!query.trim()) return;
      event.preventDefault();
      if (!isOpen) {
        isOpen = true;
        if (!suggestions.length) scheduleSuggestions(query);
        return;
      }
      if (!suggestions.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + step + suggestions.length + 1) % (suggestions.length + 1);
      if (activeIndex === suggestions.length) activeIndex = -1;
      return;
    }
    if (event.key === "Enter" && isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      close();
    }
  };

  const handleSelect = (suggestion: WordSuggestion) => {
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }
    query = suggestion.word;
    suggestions = [];
    close();
    // Focus stays in the field, where the visitor was, after the word opens.
    goto(`/?word=${encodeURIComponent(suggestion.id)}&q=${encodeURIComponent(suggestion.word)}`, {
      keepFocus: true,
    });
  };

  let storedBodyOverflow: string | null = null;
  const setScrollLock = (locked: boolean) => {
    if (typeof document === "undefined") return;
    const { body } = document;
    if (!body) return;

    if (locked) {
      if (storedBodyOverflow === null) {
        storedBodyOverflow = body.style.overflow;
      }
      body.style.overflow = "hidden";
      return;
    }

    if (storedBodyOverflow !== null) {
      body.style.overflow = storedBodyOverflow;
      storedBodyOverflow = null;
    }
  };

  $effect(() => {
    const shouldLock = isOpen && !isDisabled;
    setScrollLock(shouldLock);
    return () => setScrollLock(false);
  });
</script>

<form class="w-full" role="search" aria-label="Buscar palabras" onsubmit={handleSubmit}>
  <div class="dropdown w-full" class:dropdown-open={isOpen && !isDisabled}>
    <label
      class="input bg-base-100 rounded-field focus-within:outline-primary flex h-10 w-full items-center gap-3 border focus-within:outline-2 focus-within:outline-offset-2"
      class:input-disabled={isDisabled}
    >
      <SearchIcon class="text-muted size-4" aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-label="Buscar palabras"
        aria-autocomplete="list"
        aria-controls={LISTBOX_ID}
        aria-expanded={isOpen && !isDisabled}
        aria-activedescendant={isOpen && activeIndex >= 0
          ? `${LISTBOX_ID}-${activeIndex}`
          : undefined}
        class="grow bg-transparent text-base outline-none sm:text-sm"
        placeholder="Buscar palabras..."
        autocomplete="off"
        disabled={isDisabled}
        bind:value={query}
        oninput={handleInput}
        onfocus={handleFocus}
        onblur={handleBlur}
        onkeydown={handleKeydown}
      />
    </label>

    {#if isOpen}
      <ul
        id={LISTBOX_ID}
        class="dropdown-content bg-base-100 border-hairline rounded-box z-20 mt-2 flex max-h-80 w-full flex-col overflow-y-auto border p-1 text-left"
        role="listbox"
        aria-label="Sugerencias"
        aria-busy={loading}
      >
        {#if suggestions.length === 0}
          {#if loading}
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              class="text-muted flex items-center gap-2 px-3 py-2 text-sm"
            >
              <span
                class="loading loading-spinner loading-xs motion-reduce:hidden"
                aria-hidden="true"
              ></span>
              <span>Buscando...</span>
            </li>
          {:else}
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              class="text-muted px-3 py-2 text-sm"
            >
              <span>{lookupFailed ? "Búsqueda no disponible por ahora." : "Sin resultados"}</span>
            </li>
          {/if}
        {:else}
          {#each suggestions as suggestion, index (suggestion.id)}
            <li role="none">
              <button
                type="button"
                id={`${LISTBOX_ID}-${index}`}
                tabindex="-1"
                class={[
                  "rounded-field hover:bg-base-200 flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors duration-150",
                  index === activeIndex && "bg-base-200",
                ]}
                onmousedown={(event) => event.preventDefault()}
                onmouseenter={() => (activeIndex = index)}
                onclick={() => handleSelect(suggestion)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span class="text-sm font-medium">{suggestion.word}</span>
                <span class="text-muted line-clamp-1 text-xs">
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
