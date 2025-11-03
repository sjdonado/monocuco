<script lang="ts">
	import '../app.css';
	import { env } from '$env/dynamic/public';
	import logo from '$lib/assets/logo.webp';
	import { onMount } from 'svelte';
	import { MenuIcon } from '@lucide/svelte';
	import { dev } from '$app/environment';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import DatabaseLoading from '$lib/components/DatabaseLoading.svelte';
	import { APP_VERSION } from '$lib/config';

	const { children } = $props();

	onMount(() => {
		if (dev || !('serviceWorker' in navigator)) {
			return;
		}

		const register = async () => {
			try {
				const registration = await navigator.serviceWorker.register('/service-worker.js', {
					type: 'module'
				});
				// Immediately check for updates.
				void registration.update();
			} catch (error) {
				console.error('Service worker registration failed', error);
			}
		};

		void register();
	});
</script>

<svelte:head>
	{#if env.PUBLIC_MODE === 'production'}
		<script
			defer
			src="https://umami.donado.co/script.js"
			data-website-id="1c0c2c7a-ae4f-4f41-9e8c-7de069c9e06c"
		></script>
	{/if}
</svelte:head>

<div class="min-h-screen bg-base-200">
	<nav class="border-b border-base-300 bg-base-100">
		<div class="drawer drawer-end">
			<input id="nav-drawer" type="checkbox" class="drawer-toggle" />
			<div class="drawer-content">
				<div
					class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
				>
					<div class="flex w-full flex-col gap-4 md:flex-row md:items-center md:gap-6">
						<div class="flex w-full items-center gap-4 md:w-auto md:gap-6">
							<a href="/" class="flex gap-2">
								<img
									class="mx-auto max-h-8"
									src={logo}
									alt="Bailarina - Carnaval de Barranquilla, Colombia | Ilustración Andrés Urquina Sánchez"
								/>
								<h1 class="text-2xl font-bold normal-case">Monocuco</h1>
							</a>
							<label
								for="nav-drawer"
								class="btn btn-sm btn-ghost drawer-button ml-auto md:hidden"
								aria-label="Abrir menú"
							>
								<MenuIcon class="size-5" aria-hidden="true" />
							</label>
						</div>
						<div class="w-full md:flex-1">
							<SearchInput />
						</div>
					</div>
					<div class="hidden md:block">
						<a href="/add" class="btn btn-sm btn-primary w-32">Agregar palabra</a>
					</div>
				</div>
			</div>
			<div class="drawer-side md:hidden">
				<label for="nav-drawer" aria-label="Cerrar menú" class="drawer-overlay"></label>
				<ul class="menu bg-base-200 min-h-full w-64 p-4 text-base-content">
					<li>
						<a href="/add" class="btn btn-sm btn-primary w-full">Agregar palabra</a>
					</li>
				</ul>
			</div>
		</div>
	</nav>
	<main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 min-h-[89vh]">
		{@render children()}
		<DatabaseLoading />
	</main>
	<footer>
		<p class="flex items-center justify-center gap-1 text-xs text-base-content/70 mb-2">
			v{APP_VERSION}
			• Desarollado por
			<a href="https://sjdonado.com" target="_blank" rel="noreferrer" class="link"> @sjdonado </a>
		</p>
	</footer>
</div>
