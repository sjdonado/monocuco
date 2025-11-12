<script lang="ts">
  import { databaseLoading, type DatabaseLoading } from "$lib/db/database-loading";

  let progress = $state<DatabaseLoading>({
    isRunning: false,
    percentage: 0,
    message: "",
  });

  $effect(() => {
    const unsubscribe = databaseLoading.subscribe((value) => {
      progress = value;
    });
    return () => unsubscribe();
  });
</script>

{#if progress.isRunning}
  <div class="flex flex-col items-center justify-start pt-32">
    <div class="mb-2 flex max-w-xl items-center justify-between gap-2 text-sm">
      <span class="text-base-content/70">{progress.message}</span>
      <span class="text-primary font-semibold">{Math.round(progress.percentage)}%</span>
    </div>
    <progress class="progress progress-primary max-w-xl" value={progress.percentage} max="100"
    ></progress>
  </div>
{/if}
