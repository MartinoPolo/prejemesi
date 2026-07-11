<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import DarkModeToggle from './DarkModeToggle.svelte';

	const { Story } = defineMeta({
		title: 'Derived/DarkModeToggle',
		component: DarkModeToggle,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
</script>

<Story name="All States">
	{#snippet template()}
		<div class="flex items-start gap-8">
			<div class="flex flex-col items-center gap-2">
				<p class="text-xs text-muted-foreground">Light mode</p>
				<Button intent="outline" size="icon" aria-label="Svetly rezim">
					<Sun data-icon />
				</Button>
			</div>
			<div class="flex flex-col items-center gap-2">
				<p class="text-xs text-muted-foreground">Dark mode</p>
				<Button intent="outline" size="icon" aria-label="Tmavy rezim">
					<Moon data-icon />
				</Button>
			</div>
			<div class="flex flex-col items-center gap-2">
				<p class="text-xs text-muted-foreground">System mode</p>
				<Button intent="outline" size="icon" aria-label="Systemovy rezim">
					<Monitor data-icon />
				</Button>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template()}
		<DarkModeToggle />
	{/snippet}
</Story>
