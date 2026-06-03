<script lang="ts">
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
</script>

<div class="flex flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border">
	<!-- Image area -->
	<Skeleton class="h-40 w-full rounded-t-xl" />

	<!-- Body -->
	<div class="flex flex-1 flex-col gap-2 p-4">
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
		<div class="mt-auto flex flex-col gap-1">
			<Skeleton class="h-4 w-2/3" />
			<Skeleton class="h-4 w-2/3" />
		</div>
	</div>
</div>
