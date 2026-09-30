<script lang="ts">
  import { CheckIcon, Share2Icon } from "@lucide/svelte";
  import type { Word } from "$lib/db/repository";
  import { parseMarkdown } from "$lib/markdown";
  import { onDestroy } from "svelte";

  const {
    entry,
    shareUrl = null,
    heading = "h2",
  } = $props<{
    entry: Word;
    shareUrl: string;
    // On a word's own page the headword is the page's h1.
    heading?: "h1" | "h2";
  }>();

  const definitionHtml = $derived(parseMarkdown(entry.definition));
  const exampleHtml = $derived(parseMarkdown(entry.example));
  // Spanish order ("1 de noviembre de 2025"), read in UTC so the stored day is the shown day.
  const formattedDate = $derived(
    new Date(entry.createdAt).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
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
  class="border-hairline flex max-w-2xl flex-col gap-3 border-t py-6 first:border-t-0 first:pt-0"
>
  <header class="flex items-center justify-between gap-2">
    <svelte:element this={heading} class="text-2xl font-semibold tracking-tight sm:text-3xl"
      >{entry.word}</svelte:element
    >
    <div class="flex items-center gap-2" aria-live="polite">
      {#if copied}
        <span class="text-muted flex items-center gap-1 text-xs font-normal">
          <CheckIcon class="size-4" aria-hidden="true" />
          Enlace copiado
        </span>
      {/if}
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square text-muted hover:text-primary -mr-2"
        onclick={handleShare}
        aria-label={`Compartir ${entry.word}`}
      >
        <Share2Icon class="size-4" aria-hidden="true" />
      </button>
    </div>
  </header>

  <section class="flex flex-1 flex-col gap-3">
    <div class="prose prose-tokens prose-p:my-0 prose-ol:my-0 prose-ul:my-0 max-w-none">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html definitionHtml}
    </div>

    {#if exampleHtml}
      <div
        class="prose prose-tokens prose-p:my-0 prose-ol:my-0 prose-ul:my-0 text-muted max-w-none italic"
      >
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html exampleHtml}
      </div>
    {/if}
  </section>

  <!-- Author and date on one line from `sm` up; on phones the date gets its own line. -->
  <footer class="text-muted flex flex-col text-sm sm:flex-row sm:items-center sm:gap-x-2">
    <span class="flex items-center gap-x-1">
      <span>por</span>
      {#if entry.createdBy?.website}
        <a
          class="hover:text-primary inline-flex min-h-6 items-center underline underline-offset-2"
          href={entry.createdBy.website}
          target="_blank"
          rel="noreferrer"
        >
          {entry.createdBy.name}
        </a>
      {:else}
        <span>{entry.createdBy.name}</span>
      {/if}
    </span>
    <span class="hidden sm:inline" aria-hidden="true">•</span>
    <span>{formattedDate}</span>
  </footer>
</article>
