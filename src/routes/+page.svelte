<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { tick } from "svelte";
  import { page } from "$app/state";
  import WordCard from "$lib/components/WordCard.svelte";
  import LetterNav from "$lib/components/LetterNav.svelte";
  import {
    findAll,
    findById,
    firstLetter,
    initDB,
    type QueryAllResult,
    type Word,
  } from "$lib/db/repository";
  import { AlertCircleIcon, SearchIcon } from "@lucide/svelte";
  import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, plainText, wordPath } from "$lib/site";
  import type { PageData } from "./$types";
  import { searchFailed, searchError } from "$lib/stores/search-status";

  // Get prerendered data from load function
  const { data } = $props<{ data: PageData }>();

  const PAGE_SIZE = 12;

  const NOT_FOUND = "No encontramos la palabra solicitada.";

  // The server rendered the words for the URL the page opened with; they show until the
  // browser has loaded the data and its own result for the same URL.
  const singleResult = (word: Word): QueryAllResult => ({
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
    approximate: false,
  });
  const rendered = data.ssr?.search === page.url.search ? data.ssr : null;
  const renderedWord = rendered && "word" in rendered ? rendered.word : undefined;

  // State for displaying words
  let items = $state<Word[]>(
    renderedWord ? [renderedWord] : (rendered?.result?.items ?? data.initialWords ?? [])
  );
  let error = $state<string | null>(renderedWord === null ? NOT_FOUND : null);

  let initStarted = $state(false);
  let initDone = $state(false);

  // Track search data errors from shared store
  let searchHasFailed = $state(false);
  let searchErrorMessage = $state<string | null>(null);

  $effect(() => {
    const unsubFailed = searchFailed.subscribe((v) => (searchHasFailed = v));
    const unsubError = searchError.subscribe((v) => (searchErrorMessage = v));
    return () => {
      unsubFailed();
      unsubError();
    };
  });

  const searchValue = $derived((() => (page.url.searchParams.get("q") ?? "").trim())());

  const wordIdParam = $derived(
    (() => {
      const value = (page.url.searchParams.get("word") ?? "").trim();
      return value.length > 0 ? value : null;
    })()
  );

  const afterParam = $derived(
    (() => {
      const value = (page.url.searchParams.get("after") ?? "").trim();
      return value.length > 0 ? value : null;
    })()
  );

  const letterParam = $derived(
    (() => {
      // Same filing rule as the letter row: `?letter=é` browses E.
      const value = firstLetter((page.url.searchParams.get("letter") ?? "").trim());
      return value.length > 0 ? value : null;
    })()
  );

  let result = $state<QueryAllResult | null>(
    renderedWord ? singleResult(renderedWord) : (rendered?.result ?? null)
  );
  // The server's result is for this URL (until the visitor navigates elsewhere).
  const showsRendered = $derived(Boolean(rendered) && data.ssr?.search === page.url.search);

  const isSearching = $derived(Boolean(searchValue));
  const isPaginating = $derived(Boolean(afterParam));
  const isWordDetail = $derived(Boolean(wordIdParam));
  // A word link that fails names what went wrong in the title and the page's h1.
  const wordError = $derived(error === NOT_FOUND ? "Palabra no encontrada" : "Error");
  const isLetter = $derived(Boolean(letterParam) && !isSearching && !isWordDetail);
  // User needs the search data if they're searching, paginating, browsing a letter, or viewing a word
  const needsDB = $derived(isSearching || isPaginating || isWordDetail || isLetter);
  // Home with no search, letter, page or word.
  const isWelcome = $derived(!needsDB);

  // The word a word page shows, once it is the loaded entry (not the previous list).
  const shownWord = $derived(
    isWordDetail && items.length === 1 && items[0].id === wordIdParam ? items[0] : null
  );

  // Until the search data is ready, a search, letter, page or word would show the prerendered
  // first page, which is the wrong content; show a pending line instead. A word page also
  // waits for its own entry, so the previous list never shows under it.
  const isPending = $derived(
    !searchHasFailed &&
      ((needsDB && !initDone && !showsRendered) || (isWordDetail && !shownWord && !error))
  );

  // Use prerendered pagination data initially, then switch to search data when available
  const totalFromResult = $derived(result?.total ?? null);
  const displayTotal = $derived(totalFromResult ?? data.totalWords);
  const displayTotalPages = $derived(result?.totalPages ?? data.totalPages);

  const currentPage = $derived(result?.currentPage ?? 1);
  const totalPages = $derived(displayTotalPages);
  const hasPrev = $derived(currentPage > 1);
  const hasNext = $derived(currentPage < totalPages);

  // Disable pagination until search results are available
  const isPaginationDisabled = $derived(!result);

  let fetchToken = 0;
  let showLoadingBar = $state(false);
  let loadingBarTimer: ReturnType<typeof setTimeout> | null = null;
  const LOADING_BAR_DELAY_MS = 200;

  const startInitialLoadingBar = () => {
    if (initDone || loadingBarTimer) return;
    loadingBarTimer = setTimeout(() => {
      if (!initDone) {
        showLoadingBar = true;
      }
    }, LOADING_BAR_DELAY_MS);
  };

  const stopInitialLoadingBar = () => {
    if (loadingBarTimer) {
      clearTimeout(loadingBarTimer);
      loadingBarTimer = null;
    }
    showLoadingBar = false;
    initDone = true;
  };

  // `push` is for a page change the visitor asked for: it adds a history entry, so Back
  // steps through pages, and keeps focus on the pager. Otherwise the URL is only
  // canonicalized in place.
  const syncUrlState = (
    state: { term?: string | null; after?: string | null },
    { push = false, base = null }: { push?: boolean; base?: string | null } = {}
  ) => {
    if (!browser) return;
    // A load canonicalizes the URL it was started for; if the visitor has navigated since
    // (Back, a link), leave the newer entry alone.
    if (base && base !== window.location.href) return;
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
    // Canonicalizing in place must not steal focus or scroll from a visitor who is
    // already typing or reading; a page change keeps focus in the pager and scrolls up.
    return goto(target, {
      replaceState: !push,
      keepFocus: true,
      noScroll: !push,
    });
  };

  async function loadWord(wordId: string) {
    if (!browser) return;
    const currentToken = ++fetchToken;
    error = null;

    try {
      const word = await findById(wordId);

      if (currentToken !== fetchToken) return;

      if (word) {
        items = [word];
        result = singleResult(word);
      } else {
        items = [];
        error = NOT_FOUND;
        result = null;
      }
    } catch (err) {
      console.error(err);
      if (currentToken !== fetchToken) return;
      items = [];
      error = "No pudimos cargar la palabra. Intenta nuevamente.";
      result = null;
    }
  }

  async function loadWords(
    term: string | null,
    afterToken: string | null,
    letter: string | null = null
  ) {
    if (!browser) return;
    const base = window.location.href;
    const currentToken = ++fetchToken;
    error = null;

    try {
      const response = await findAll({
        term: term ?? undefined,
        after: afterToken,
        letter,
        pageSize: PAGE_SIZE,
      });

      if (currentToken !== fetchToken) return;

      items = response.items;
      result = response;

      console.debug(
        `Loaded ${response.items.length} entries in ${response.loadTimeSeconds.toFixed(3)}s`
      );

      syncUrlState(
        {
          term,
          after: response.currentPage > 1 ? response.currentAfter : null,
        },
        { base }
      );
    } catch (err) {
      console.error(err);
      if (currentToken !== fetchToken) return;
      items = [];
      error = "No pudimos cargar las palabras. Intenta nuevamente.";
      result = null;
      syncUrlState({ term, after: null }, { base });
    }
  }

  // Initialize search data in background (even if not immediately needed)
  $effect(() => {
    if (!browser || initStarted || searchHasFailed) return;

    initStarted = true;
    startInitialLoadingBar();
    searchError.set(null);
    searchFailed.set(false);

    // Warm up the search index and data in the background
    initDB()
      .then(() => {
        stopInitialLoadingBar();
        // The audit waits for this: the server's HTML alone proves nothing about the client.
        document.documentElement.dataset.searchReady = "";
        console.log("[Page] Search data ready");
      })
      .catch((err) => {
        console.error("[Page] Search data initialization failed:", err);
        searchFailed.set(true);
        searchError.set(
          "No pudimos cargar los datos de búsqueda locales. Intenta de nuevo más tarde."
        );
        stopInitialLoadingBar();
      });
  });

  // Load data when URL params change
  $effect(() => {
    if (!browser) return;

    // CRITICAL: Read reactive values synchronously BEFORE any async operations
    // so Svelte tracks them as dependencies and re-runs effect on changes
    const wordId = wordIdParam;
    const term = searchValue || null;
    const afterToken = afterParam;
    const letter = isLetter ? letterParam : null;
    const needsDatabase = needsDB;
    const ready = initDone;
    const failed = searchHasFailed;

    if (failed) {
      // Keep what the server rendered for this URL; otherwise the welcome screen still has
      // the first page built with the site.
      if (!showsRendered) {
        items = needsDatabase ? [] : data.initialWords || [];
        result = null;
      }
      error = null;
      return;
    }

    // If we need search data but it's not ready yet, wait for initialization
    if (needsDatabase && !ready) {
      return;
    }

    // If showing prerendered content and search data is ready, load fresh data
    if (!needsDatabase && ready) {
      void loadWords(null, null);
      return;
    }

    // Load data from search data cache
    if (needsDatabase && ready) {
      if (wordId) {
        void loadWord(wordId);
      } else {
        void loadWords(term, afterToken, letter);
      }
    }
  });

  const buildShareUrl = (wordId: string, word: string): string => {
    const url = new URL("/", page.url.origin);

    url.searchParams.set("word", wordId);
    url.searchParams.set("q", word);

    return url.toString();
  };

  const goToAfter = async (target: string | null) => {
    const navigation = syncUrlState(
      {
        term: searchValue,
        after: target,
      },
      { push: true }
    );
    // On the first or last page the button just used becomes disabled and drops focus;
    // keep it in the pager, on the current page number.
    await navigation;
    await tick();
    if (
      document.activeElement === document.body ||
      (document.activeElement as HTMLButtonElement)?.disabled
    ) {
      // Without scrolling back down: the new page starts at the top.
      document
        .querySelector<HTMLButtonElement>("button[aria-current=page]")
        ?.focus({ preventScroll: true });
    }
  };

  const description = $derived(
    shownWord
      ? `${shownWord.word}: ${plainText(shownWord.definition)}`.slice(0, 300)
      : isLetter
        ? `Palabras y expresiones del español barranquillero que empiezan por ${letterParam}, con su definición, en Monocuco.`
        : SITE_DESCRIPTION
  );

  // Structured data: the site and its dictionary, or the word on a word's page. `<` is
  // escaped so a definition can never close the script element.
  const structuredData = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@graph": shownWord
        ? [
            {
              "@type": "DefinedTerm",
              name: shownWord.word,
              description: plainText(shownWord.definition),
              url: `${SITE_URL}${wordPath(shownWord.id)}`,
              inLanguage: "es",
              inDefinedTermSet: `${SITE_URL}/#dictionary`,
            },
          ]
        : [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: `${SITE_URL}/`,
              name: SITE_NAME,
              description: SITE_DESCRIPTION,
              inLanguage: "es",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "DefinedTermSet",
              "@id": `${SITE_URL}/#dictionary`,
              name: "Monocuco, diccionario de español barranquillero",
              url: `${SITE_URL}/`,
              inLanguage: "es",
              license: "https://opensource.org/licenses/MIT",
              creator: {
                "@type": "Person",
                name: "Juan Rodriguez Donado",
                alternateName: "sjdonado",
                url: "https://sjdonado.com",
                sameAs: ["https://github.com/sjdonado"],
              },
            },
          ],
    }).replace(/</g, "\\u003c")
  );
  // Split so the closing tag never ends this component's own script block.
  const structuredDataTag = $derived(
    `<script type="application/ld+json">${structuredData}</` + "script>"
  );

  // Only for a result the browser or the server has, never the first page's fallback numbers.
  const pageLabel = $derived(
    result && !isPending && !isWordDetail && result.totalPages > 1
      ? `Página ${result.currentPage} de ${result.totalPages}`
      : null
  );

  const handlePrev = () => goToAfter(result?.prevAfter ?? null);
  const handleNext = () => goToAfter(result?.nextAfter ?? null);
</script>

<svelte:head>
  {#if searchHasFailed}
    <title>Monocuco | Error</title>
  {:else if isWordDetail}
    <!-- Neutral while loading, then the word, or "not found". -->
    <title>
      Monocuco{error ? ` | ${wordError}` : shownWord ? ` | ${shownWord.word}` : ""}
    </title>
  {:else if isSearching}
    <title>Monocuco | Buscar "{searchValue}"</title>
  {:else if isLetter}
    <title>Monocuco | Palabras por letra: {letterParam}</title>
  {:else}
    <title>Monocuco | Diccionario de español barranquillero</title>
  {/if}
  <meta name="description" content={description} />
  {#if (isSearching && !isWordDetail) || (isWordDetail && error)}
    <!-- A search result or a missing word is not a page to keep in an index. -->
    <meta name="robots" content="noindex" />
  {/if}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html structuredDataTag}
</svelte:head>

<div class="flex flex-col gap-6">
  {#if showLoadingBar}
    <div
      role="progressbar"
      aria-label="Carga inicial"
      class="bg-primary pointer-events-none fixed top-0 left-0 z-50 h-1 w-full motion-safe:animate-pulse"
    ></div>
  {/if}
  {#if searchHasFailed}
    <section role="alert" class="bg-base-100 border-hairline rounded-box flex gap-3 border p-6">
      <AlertCircleIcon class="text-error size-5 shrink-0" aria-hidden="true" />
      <div class="flex flex-col gap-2">
        <h1 class="text-lg font-semibold">No pudimos cargar los datos de búsqueda</h1>
        <p class="text-muted text-sm">
          {searchErrorMessage ??
            "El buscador no está disponible en este momento. Intenta de nuevo más tarde."}
        </p>
        <div>
          <button
            type="button"
            class="btn btn-ghost border-hairline btn-sm border"
            onclick={() => location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    </section>
    {#if (isWelcome || showsRendered) && items.length > 0}
      <!-- The server's words, or the first page built with the site, work without the data. -->
      <div class="flex flex-col">
        {#each items as entry (entry.id)}
          <WordCard {entry} shareUrl={buildShareUrl(entry.id, entry.word)} />
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Every state is a search: all words is the empty query, a letter or a word is a
         narrower one. Each starts with the same result line, on the left. The h1 names the
         page for assistive technology and search engines; on a word's page the headword is it. -->
    {#if !shownWord}
      <h1 class="sr-only">
        {#if isWordDetail}
          {error ? wordError : "Monocuco, diccionario de español barranquillero"}
        {:else if isSearching}
          Resultados para "{searchValue}" en Monocuco
        {:else if isLetter}
          Palabras con {letterParam} en Monocuco
        {:else}
          Monocuco, diccionario de español barranquillero
        {/if}
      </h1>
    {/if}
    {#if !error}
      <section class="flex flex-col gap-4">
        <div class="flex items-baseline justify-between gap-4">
          <p
            class="text-muted min-w-0 grow text-sm font-medium break-words tabular-nums"
            aria-live="polite"
          >
            {#if isWordDetail || isSearching}
              {#if result && !isPending}
                {result.total}
                {result.approximate
                  ? `palabra${result.total === 1 ? "" : "s"} parecida${result.total === 1 ? "" : "s"} a`
                  : `palabra${result.total === 1 ? "" : "s"} encontrada${result.total === 1 ? "" : "s"} para`}
              {:else}
                Buscando
              {/if}
              {#if shownWord?.word ?? searchValue}
                <span class="text-base-content font-semibold"
                  >"{shownWord?.word ?? searchValue}"</span
                >
              {/if}
            {:else if isLetter}
              {#if result && !isPending}
                {result.total} palabra{result.total === 1 ? "" : "s"} encontrada{result.total === 1
                  ? ""
                  : "s"} con
              {:else}
                Buscando palabras con
              {/if}
              <span class="text-base-content font-semibold">{letterParam}</span>
            {:else}
              {displayTotal} palabras encontradas
            {/if}
            {#if pageLabel}
              <!-- Read with the count, so paging is announced: the count alone never changes. -->
              <span class="sr-only">, {pageLabel}</span>
            {/if}
          </p>
          {#if pageLabel}
            <!-- Which page of the result this is, across from the count. -->
            <p class="text-muted shrink-0 text-sm tabular-nums" aria-hidden="true">{pageLabel}</p>
          {/if}
        </div>
        {#if !isSearching && !isWordDetail}
          <LetterNav current={isLetter ? letterParam : null} />
        {/if}
      </section>
    {/if}

    {#if isPending}
      <!-- The result line above already says "Buscando"; this is only the visual cue. -->
      <span
        class="loading loading-spinner loading-sm text-muted motion-reduce:hidden"
        aria-hidden="true"
      ></span>
    {:else if error}
      <div
        role="alert"
        class="bg-base-100 border-hairline rounded-box flex items-center gap-3 border p-4 text-sm"
      >
        <AlertCircleIcon class="text-error size-5 shrink-0" aria-hidden="true" />
        <span class="flex flex-col gap-1">
          {error}
          {#if isWordDetail}
            <a href="/" class="link hover:text-primary">Ver todas las palabras</a>
          {/if}
        </span>
      </div>
    {:else if items.length === 0}
      <div
        role="status"
        class="border-hairline rounded-box text-muted flex flex-col items-center gap-2 border p-6 text-center text-sm"
      >
        <SearchIcon class="text-muted size-5" aria-hidden="true" />
        <span>
          {isLetter
            ? `No hay palabras con ${letterParam}.`
            : "No encontramos palabras para esta búsqueda."}
        </span>
      </div>
    {:else}
      <div class="flex flex-col">
        {#each items as entry (entry.id)}
          <WordCard
            {entry}
            shareUrl={buildShareUrl(entry.id, entry.word)}
            heading={shownWord ? "h1" : "h2"}
          />
        {/each}
      </div>
    {/if}

    {#if displayTotal > PAGE_SIZE && !isPending && !isWordDetail && !error}
      <div
        class="border-hairline flex min-h-10 max-w-2xl items-center justify-center gap-1 border-t pt-8 sm:gap-2"
      >
        <button
          type="button"
          class="btn btn-ghost border-hairline h-10 min-h-10 border px-3 sm:h-8 sm:min-h-8"
          data-pagination="prev"
          onclick={handlePrev}
          disabled={!hasPrev || isPaginationDisabled}
        >
          Anterior
        </button>

        {#if isPaginationDisabled}
          <!-- Show simplified pagination when search data is not ready -->
          <span class="text-muted text-sm tabular-nums">
            Página {currentPage} de {totalPages}
          </span>
        {:else if result?.pages}
          <!-- Show full pagination when search data is ready -->
          {#each result.pages as pageLink (pageLink.number)}
            <button
              type="button"
              class="btn btn-ghost btn-square h-10 min-h-10 w-8 tabular-nums sm:h-8 sm:min-h-8"
              class:bg-base-200={pageLink.number === currentPage}
              class:font-semibold={pageLink.number === currentPage}
              onclick={() => goToAfter(pageLink.after)}
              data-page={pageLink.number}
              aria-current={pageLink.number === currentPage ? "page" : undefined}
            >
              {pageLink.number}
            </button>
          {/each}
        {:else}
          <!-- Fallback when no pages data available -->
          <span class="text-muted text-sm tabular-nums">
            Página {currentPage} de {totalPages}
          </span>
        {/if}

        <button
          type="button"
          class="btn btn-ghost border-hairline h-10 min-h-10 border px-3 sm:h-8 sm:min-h-8"
          data-pagination="next"
          onclick={handleNext}
          disabled={!hasNext || isPaginationDisabled}
        >
          Siguiente
        </button>
      </div>
    {/if}
  {/if}
</div>
