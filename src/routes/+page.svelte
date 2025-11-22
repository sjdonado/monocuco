<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import WordCard from "$lib/components/WordCard.svelte";
  import WordCardSkeleton from "$lib/components/WordCardSkeleton.svelte";
  import { findAll, findById, type QueryAllResult, type Word } from "$lib/db/repository";
  import { AlertCircleIcon } from "@lucide/svelte";
  import type { Page } from "@sveltejs/kit";

  const PAGE_SIZE = 12;
  const SKELETON_ITEMS = Array.from({ length: PAGE_SIZE }, (_, i) => i);

  let items = $state<Word[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let pageData = $state<Page | null>(null);

  $effect(() => {
    const unsubscribe = page.subscribe((value) => {
      pageData = value;
    });
    return () => unsubscribe();
  });

  const searchValue = $derived((() => (pageData?.url.searchParams.get("q") ?? "").trim())());

  const wordIdParam = $derived(
    (() => {
      const value = (pageData?.url.searchParams.get("word") ?? "").trim();
      return value.length > 0 ? value : null;
    })()
  );

  const afterParam = $derived(
    (() => {
      const value = (pageData?.url.searchParams.get("after") ?? "").trim();
      return value.length > 0 ? value : null;
    })()
  );

  let result = $state<QueryAllResult | null>(null);

  const isSearching = $derived(Boolean(searchValue));

  const currentPage = $derived(result?.currentPage ?? 1);
  const totalPages = $derived(result?.totalPages ?? 1);
  const hasPrev = $derived(currentPage > 1);
  const hasNext = $derived(currentPage < totalPages);

  let fetchToken = 0;

  const syncUrlState = (state: { term?: string | null; after?: string | null }) => {
    if (!browser) return;
    const url = new URL(window.location.href);
    let changed = false;

    if (state.term !== undefined) {
      const trimmed = (state.term ?? "").trim();
      const current = url.searchParams.get("q");
      if (trimmed && current !== trimmed) {
        url.searchParams.set("q", trimmed);
        changed = true;
      } else if (!trimmed && current) {
        url.searchParams.delete("q");
        changed = true;
      }
    }

    if (state.after !== undefined) {
      const target = state.after?.trim() ?? "";
      const current = url.searchParams.get("after");
      if (target && current !== target) {
        url.searchParams.set("after", target);
        changed = true;
      } else if (!target && current) {
        url.searchParams.delete("after");
        changed = true;
      }
    }

    if (!changed) return;

    const target = `${url.pathname}${url.search}${url.hash ?? ""}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash ?? ""}`;
    if (target === current) return;
    void goto(target, {
      replaceState: true,
      keepFocus: false,
      noScroll: false,
    });
  };

  async function loadWord(wordId: string) {
    if (!browser) return;
    const currentToken = ++fetchToken;
    loading = true;
    error = null;

    try {
      const word = await findById(wordId);

      if (currentToken !== fetchToken) return;

      if (word) {
        items = [word];
        result = {
          items: [word],
          total: 1,
          currentAfter: null,
          nextAfter: null,
          prevAfter: null,
          startIndex: 1,
          endIndex: 1,
          currentPage: 1,
          totalPages: 1,
          pages: [],
          loadTimeSeconds: 0,
        };
      } else {
        items = [];
        error = "No encontramos la palabra solicitada.";
        result = null;
      }
    } catch (err) {
      console.error(err);
      if (currentToken !== fetchToken) return;
      items = [];
      error = "No pudimos cargar la palabra. Intenta nuevamente.";
      result = null;
    } finally {
      if (currentToken === fetchToken) {
        loading = false;
      }
    }
  }

  async function loadWords(term: string | null, afterToken: string | null) {
    if (!browser) return;
    const currentToken = ++fetchToken;
    loading = true;
    error = null;

    try {
      const response = await findAll({
        term: term ?? undefined,
        after: afterToken,
        pageSize: PAGE_SIZE,
      });

      if (currentToken !== fetchToken) return;

      items = response.items;
      result = response;

      console.debug(
        `Loaded ${response.items.length} entries in ${response.loadTimeSeconds.toFixed(3)}s`
      );

      syncUrlState({
        term,
        after: response.currentPage > 1 ? response.currentAfter : null,
      });
    } catch (err) {
      console.error(err);
      if (currentToken !== fetchToken) return;
      items = [];
      error = "No pudimos cargar las palabras. Intenta nuevamente.";
      result = null;
      syncUrlState({
        term,
        after: null,
      });
    } finally {
      if (currentToken === fetchToken) {
        loading = false;
      }
    }
  }

  $effect(() => {
    if (!browser) return;

    // Defer data loading to next tick to allow initial render to complete first
    const timeoutId = setTimeout(() => {
      const wordId = wordIdParam;
      if (wordId) {
        void loadWord(wordId);
      } else {
        const term = searchValue || null;
        const afterToken = afterParam;
        void loadWords(term, afterToken);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  });

  const buildShareUrl = (wordId: string, word: string): string => {
    const url = new URL("/", window.location.origin);

    url.searchParams.set("word", wordId);
    url.searchParams.set("q", word);

    if (isSearching && currentPage && currentPage > 1 && result?.currentAfter) {
      url.searchParams.set("after", result.currentAfter);
    }

    return url.toString();
  };

  const goToAfter = (target: string | null) => {
    syncUrlState({
      term: searchValue,
      after: target,
    });
  };

  const handlePrev = () => goToAfter(result?.prevAfter ?? null);
  const handleNext = () => goToAfter(result?.nextAfter ?? null);
</script>

<svelte:head>
  {#if isSearching}
    <title>Monocuco | Buscar "{searchValue}"</title>
  {:else}
    <title>Monocuco</title>
  {/if}
</svelte:head>

<div class="flex flex-col gap-6">
  <section class="flex flex-wrap items-center justify-between gap-3">
    {#if isSearching}
      <div class="flex flex-col gap-2">
        <h1 class="text-base-content text-3xl font-bold">Resultados de búsqueda</h1>
        <p class="text-base-content/70">
          Resultados para <span class="text-primary font-semibold">"{searchValue}"</span>
        </p>
        {#if result}
          <div class="text-base-content/70 mt-2 text-xs">
            <span>
              {result.total} resultado{result.total > 1 ? "s" : ""} en {result.loadTimeSeconds}s.
            </span>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        <h1 class="text-base-content text-3xl font-bold">Bienvenido</h1>
        <div class="text-base-content/70 flex flex-wrap gap-1 text-sm">
          <p>
            Diccionario abierto y gratuito de
            <a
              class="link"
              href="https://es.wikipedia.org/wiki/Español_barranquillero"
              target="_blank"
              rel="noreferrer">Español barranquillero</a
            >.
          </p>
          <p>
            Código fuente disponible en
            <a
              class="link"
              href="https://github.com/sjdonado/monocuco"
              target="_blank"
              rel="noreferrer">Github</a
            >.
          </p>
        </div>
      </div>
    {/if}
  </section>

  {#if error}
    <div class="alert alert-error">
      <AlertCircleIcon class="text-error-content size-5 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  {:else if loading}
    <div class="flex flex-col gap-6">
      {#each SKELETON_ITEMS as i (i)}
        <WordCardSkeleton />
      {/each}
    </div>
  {:else if items.length === 0}
    <div class="alert alert-warning">
      <AlertCircleIcon class="text-warning-content size-5 shrink-0" aria-hidden="true" />
      <span>No encontramos palabras para esta búsqueda.</span>
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      {#each items as entry (entry.id)}
        <WordCard {entry} shareUrl={buildShareUrl(entry.id, entry.word)} />
      {/each}
    </div>
  {/if}

  {#if (result?.total ?? 0) > PAGE_SIZE}
    <div class="flex max-w-2xl items-center justify-center gap-4 pt-4">
      <button type="button" class="btn btn-sm" onclick={handlePrev} disabled={!hasPrev}>
        Anterior
      </button>
      {#each result?.pages ?? [] as pageLink (pageLink.number)}
        <button
          type="button"
          class="link cursor-pointer text-sm font-semibold"
          class:text-primary={pageLink.number === currentPage}
          onclick={() => goToAfter(pageLink.after)}
          aria-current={pageLink.number === currentPage ? "page" : undefined}
        >
          {pageLink.number}
        </button>
      {/each}
      <button type="button" class="btn btn-sm" onclick={handleNext} disabled={!hasNext}>
        Siguiente
      </button>
    </div>
  {/if}
</div>
