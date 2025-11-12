<script lang="ts">
  import { Share2Icon } from "@lucide/svelte";
  import type { Word } from "$lib/db/repository";
  import { parseMarkdown } from "$lib/markdown";
  import { onDestroy } from "svelte";

  const { entry, shareUrl = null } = $props<{
    entry: Word;
    shareUrl: string;
  }>();

  const definitionHtml = $derived(parseMarkdown(entry.definition));
  const exampleHtml = $derived(parseMarkdown(entry.example));
  const formattedDate = $derived(
    (() => {
      const date = new Date(entry.createdAt);
      const month = date.toLocaleString("es-ES", { month: "long" });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
      return `${capitalizedMonth} ${date.getDate()}, ${date.getFullYear()}`;
    })()
  );

  let copied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: entry.word,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
        if (copyTimeout) {
          clearTimeout(copyTimeout);
        }
        copyTimeout = setTimeout(() => {
          copied = false;
          copyTimeout = null;
        }, 2000);
        return;
      }

      if (typeof window !== "undefined") {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("No se pudo compartir la palabra", error);
      copied = false;
    }
  };

  onDestroy(() => {
    if (copyTimeout) {
      clearTimeout(copyTimeout);
    }
  });
</script>

<article
  id={entry.id}
  class="card bg-base-100 border-base-200 max-w-2xl border shadow-lg dark:border-gray-700"
>
  <div class="card-body gap-4">
    <header class="flex items-center justify-between gap-2">
      <h2 class="card-title text-3xl leading-snug">{entry.word}</h2>
      <div class="flex items-center gap-2" aria-live="polite">
        {#if copied}
          <span class="text-success text-xs font-normal">Enlace copiado</span>
        {/if}
        <button
          type="button"
          class="btn btn-ghost btn-sm gap-2"
          onclick={handleShare}
          aria-label={`Compartir ${entry.word}`}
        >
          <Share2Icon class="size-4" aria-hidden="true" />
          <span class="hidden sm:inline">Compartir</span>
        </button>
      </div>
    </header>

    <section class="flex-1 space-y-4">
      <div class="prose max-w-none">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html definitionHtml}
      </div>

      {#if exampleHtml}
        <div class="prose mt-1 italic">
          <!-- eslint-disable-next-line svelte/no-at-html-tags -->
          {@html exampleHtml}
        </div>
      {/if}
    </section>

    <footer class="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
      <div>
        <span>por</span>
        {#if entry.createdBy?.website}
          <a
            class="link link-primary"
            href={entry.createdBy.website}
            target="_blank"
            rel="noreferrer"
          >
            {entry.createdBy.name}
          </a>
        {:else}
          <span>{entry.createdBy.name}</span>
        {/if}
        <span>{formattedDate}</span>
      </div>
    </footer>
  </div>
</article>
