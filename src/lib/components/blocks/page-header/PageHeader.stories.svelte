<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { PageHeader } from './index.js';

	const { Story } = defineMeta({
		title: 'Blocks/PageHeader',
		component: PageHeader,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import PlusIcon from '@lucide/svelte/icons/plus';
</script>

<Story name="Default">
	<PageHeader title="Moje seznamy" />
</Story>

<Story name="All Sizes">
	<div class="flex flex-col gap-6">
		<div>
			<p class="mb-2 text-xs text-muted-foreground">sm</p>
			<PageHeader title="Moje seznamy" size="sm" />
		</div>
		<div>
			<p class="mb-2 text-xs text-muted-foreground">md</p>
			<PageHeader title="Moje seznamy" size="md" />
		</div>
		<div>
			<p class="mb-2 text-xs text-muted-foreground">lg</p>
			<PageHeader title="Moje seznamy" size="lg" />
		</div>
	</div>
</Story>

<Story name="With Toolbar">
	<PageHeader title="Moje seznamy" size="md">
		{#snippet toolbar()}
			<Button intent="ghost" size="icon-sm" aria-label="Settings"
				><SettingsIcon data-icon /></Button
			>
			<Button intent="primary" size="sm"
				><PlusIcon data-icon="inline-start" /> Vytvorit</Button
			>
		{/snippet}
	</PageHeader>
</Story>
