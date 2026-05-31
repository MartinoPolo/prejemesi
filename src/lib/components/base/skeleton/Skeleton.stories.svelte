<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	const { Story } = defineMeta({
		title: 'Base/Skeleton',
		component: Skeleton,
		tags: ['autodocs'],
	});
</script>

<Story name="Default">
	<Skeleton class="h-4 w-48" />
</Story>

<Story name="Card Skeleton">
	<div class="flex flex-col gap-3">
		<Skeleton class="h-32 w-64 rounded-xl" />
		<Skeleton class="h-4 w-48" />
		<Skeleton class="h-4 w-32" />
	</div>
</Story>

<Story name="Avatar & Lines">
	<div class="flex items-center gap-4">
		<Skeleton class="size-12 rounded-full" />
		<div class="flex flex-col gap-2">
			<Skeleton class="h-4 w-40" />
			<Skeleton class="h-3 w-28" />
		</div>
	</div>
</Story>
