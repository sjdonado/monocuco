<script lang="ts">
	import { splashScreenProgress, type SplashScreenProgress } from '$lib/db/splash-screen-progress';

	let progress = $state<SplashScreenProgress>({
		enabled: false,
		isRunning: false,
		stage: 'idle',
		percentage: 0,
		message: ''
	});

	$effect(() => {
		const unsubscribe = splashScreenProgress.subscribe((value) => {
			progress = value;
		});
		return () => unsubscribe();
	});

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
	};
</script>

{#if progress.enabled && progress.isRunning}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 backdrop-blur-sm">
		<div class="card w-full max-w-md bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-center">Cargando base de datos</h2>

				<div class="py-4">
					<div class="mb-2 flex items-center justify-between text-sm">
						<span class="text-base-content/70">{progress.message}</span>
						<span class="font-semibold text-primary">{Math.round(progress.percentage)}%</span>
					</div>

					<progress class="progress progress-primary w-full" value={progress.percentage} max="100"
					></progress>

					{#if progress.downloadProgress}
						<div class="mt-2 text-xs text-base-content/50 text-center">
							{formatBytes(progress.downloadProgress.loaded)}
							{#if progress.downloadProgress.total > 0}
								/ {formatBytes(progress.downloadProgress.total)}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
