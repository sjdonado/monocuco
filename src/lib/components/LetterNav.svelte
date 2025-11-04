<script lang="ts">
	import { browser } from '$app/environment';
	import { getLetterCounts, type LetterCount } from '$lib/db/repository';

	let letterCounts = $state<LetterCount[]>([]);
	let loading = $state(true);

	$effect(() => {
		if (!browser) return;

		const loadCounts = async () => {
			try {
				const counts = await getLetterCounts();
				letterCounts = counts;
			} catch (error) {
				console.error('Failed to load letter counts', error);
			} finally {
				loading = false;
			}
		};

		void loadCounts();
	});

	const getSearchUrl = (letter: string) => {
		if (letter === 'Todas') {
			return '/';
		}
		return `/?q=${encodeURIComponent(letter)}`;
	};
</script>

<nav aria-label="Navegación por letras">
	{#if !loading}
		<h2 class="text-sm font-semibold text-base-content/70 mb-3">Palabras por letra</h2>
		<ul class="space-y-1 text-sm">
			{#each letterCounts as { letter, count } (letter)}
				<li>
					<a href={getSearchUrl(letter)} class="flex justify-between p-0">
						<span class="link link-primary" class:font-bold={letter === 'Todas'}>{letter}</span>
						<span class="text-base-content/60">{count}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</nav>
