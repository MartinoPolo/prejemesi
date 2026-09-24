<script lang="ts">
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
</script>

<!-- Mirrors the sticker gift card chrome so the loading grid doesn't jump on swap -->
<div
	class="grid h-[280px] grid-rows-[136px_minmax(0,1fr)] overflow-hidden rounded-panel border-[2.5px] border-ink bg-card shadow-sticker sm:flex sm:h-auto sm:flex-col"
>
	<!-- Image area: 4:3 (issue #183), mirrors gift_card_variants' imageArea -->
	<Skeleton
		class="size-full rounded-none border-b-[2.5px] border-ink sm:aspect-[4/3] sm:h-auto"
	/>

	<!-- Body -->
	<div class="flex min-h-0 flex-1 flex-col gap-2 p-2 sm:p-4">
		<!-- Name + piece count -->
		<div class="flex flex-wrap items-baseline gap-1.5">
			<Skeleton class="h-5 w-3/4" />
			<Skeleton class="h-4 w-16" />
		</div>

		<!-- Price -->
		<Skeleton class="h-5 w-20" />

		<!-- Priority -->
		<Skeleton class="h-5 w-24 rounded-full" />

		<!-- Link rows -->
		<div class="flex flex-col gap-1">
			<Skeleton class="h-4 w-2/3" />
			<Skeleton class="h-4 w-2/3" />
		</div>
	</div>
</div>
