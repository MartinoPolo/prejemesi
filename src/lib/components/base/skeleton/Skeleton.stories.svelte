<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';

	const { Story } = defineMeta({
		title: 'Base/Skeleton',
		component: Skeleton,
		tags: ['autodocs'],
	});
</script>

<Story name="All Variants">
	{#snippet template()}
		<div class="flex flex-col gap-8">
			<div class="flex flex-col gap-2">
				<span class="text-xs text-foreground-subtle">Default line</span>
				<Skeleton class="h-4 w-48" />
			</div>
			<div class="flex flex-col gap-2">
				<span class="text-xs text-foreground-subtle">Card</span>
				<div class="flex flex-col gap-3">
					<Skeleton class="h-32 w-64 rounded-xl" />
					<Skeleton class="h-4 w-48" />
					<Skeleton class="h-4 w-32" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<span class="text-xs text-foreground-subtle">Avatar & lines</span>
				<div class="flex items-center gap-4">
					<Skeleton class="size-12 rounded-full" />
					<div class="flex flex-col gap-2">
						<Skeleton class="h-4 w-40" />
						<Skeleton class="h-3 w-28" />
					</div>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template()}
		<Skeleton class="h-4 w-48" />
	{/snippet}
</Story>

<Story name="Card Skeleton">
	{#snippet template()}
		<div class="flex flex-col gap-3">
			<Skeleton class="h-32 w-64 rounded-xl" />
			<Skeleton class="h-4 w-48" />
			<Skeleton class="h-4 w-32" />
		</div>
	{/snippet}
</Story>

<Story name="Avatar & Lines">
	{#snippet template()}
		<div class="flex items-center gap-4">
			<Skeleton class="size-12 rounded-full" />
			<div class="flex flex-col gap-2">
				<Skeleton class="h-4 w-40" />
				<Skeleton class="h-3 w-28" />
			</div>
		</div>
	{/snippet}
</Story>
