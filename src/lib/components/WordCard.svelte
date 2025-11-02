<script lang="ts">
	import { Share2Icon } from '@lucide/svelte';
	import type { Word } from '$lib/db/words';
	import { parseMarkdown } from '$lib/markdown';
	import { onDestroy } from 'svelte';

	const {
	entry,
	shareUrl = null
	} = $props<{
	entry: Word;
	shareUrl: string | null;
	}>();

	const definitionHtml = $derived(parseMarkdown(entry.definition));
	const exampleHtml = $derived(parseMarkdown(entry.example));
	const formattedDate = $derived(
		new Date(entry.createdAt).toLocaleString('default', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	const handleShare = async () => {
		if (!shareUrl) return;

		try {
			if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
				await navigator.share({
					title: entry.word,
					url: shareUrl
				});
				return;
			}

			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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

			if (typeof window !== 'undefined') {
				window.open(shareUrl, '_blank', 'noopener,noreferrer');
			}
		} catch (error) {
			console.error('No se pudo compartir la palabra', error);
			copied = false;
		}
	};

	onDestroy(() => {
		if (copyTimeout) {
			clearTimeout(copyTimeout);
		}
	});
</script>

<article id={entry.id} class="card bg-base-100 shadow-lg border border-base-200 dark:border-gray-700">
		<div class="card-body gap-4">
			<header class="flex gap-2 items-center justify-between">
				<h2 class="card-title text-3xl leading-snug">{entry.word}</h2>
				{#if shareUrl}
					<div class="flex items-center gap-2" aria-live="polite">
						{#if copied}
							<span class="text-xs font-normal text-success">Enlace copiado</span>
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
				{/if}
			</header>

		<section class="space-y-4 flex-1">
			<div class="prose max-w-none">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html definitionHtml}
			</div>

			{#if exampleHtml}
				<div class="mt-1 prose italic">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html exampleHtml}
				</div>
			{/if}
		</section>

		<footer class="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
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
