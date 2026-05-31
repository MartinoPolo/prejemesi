<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { KBD_TONES, KBD_FORMATS, Kbd } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Kbd',
		component: Kbd,
		tags: ['autodocs'],
		argTypes: {
			format: {
				control: 'select',
				options: [...KBD_FORMATS],
			},
			tone: {
				control: 'select',
				options: [...KBD_TONES],
			},
		},
	});
</script>

<script lang="ts">
	import type { KbdProps, KbdTone, KbdFormat } from './kbd_variants.js';
	import { KbdGroup } from './index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CommandIcon from '@lucide/svelte/icons/command';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import DeleteIcon from '@lucide/svelte/icons/delete';
	import SearchIcon from '@lucide/svelte/icons/search';

	const singleKeySamples: {
		label: string;
		format: KbdFormat;
		tone: KbdTone;
		content: 'letter' | 'escape' | 'command' | 'enter' | 'delete' | 'arrows';
	}[] = [
		{ label: 'Default', format: 'default', tone: 'neutral', content: 'letter' },
		{ label: 'Lucide', format: 'lucide', tone: 'neutral', content: 'command' },
		{ label: 'Mono', format: 'mono', tone: 'neutral', content: 'letter' },
		{ label: 'Default accent', format: 'default', tone: 'accent', content: 'escape' },
		{ label: 'Lucide accent', format: 'lucide', tone: 'accent', content: 'enter' },
		{ label: 'Mono accent', format: 'mono', tone: 'accent', content: 'letter' },
		{ label: 'Default inverted', format: 'default', tone: 'inverted', content: 'escape' },
		{ label: 'Lucide inverted', format: 'lucide', tone: 'inverted', content: 'delete' },
		{ label: 'Mono inverted', format: 'mono', tone: 'inverted', content: 'letter' },
		{ label: 'Arrow keys', format: 'lucide', tone: 'neutral', content: 'arrows' },
	];
</script>

{#snippet keyContent(content: (typeof singleKeySamples)[number]['content'])}
	{#if content === 'command'}
		<CommandIcon />
	{:else if content === 'enter'}
		<CornerDownLeftIcon />
	{:else if content === 'delete'}
		<DeleteIcon />
	{:else if content === 'escape'}
		Esc
	{:else if content === 'arrows'}
		<ArrowUpIcon /><ArrowDownIcon /><ArrowLeftIcon /><ArrowRightIcon />
	{:else}
		K
	{/if}
{/snippet}

<Story name="All Variants">
	{#snippet template(args: KbdProps)}
		<div class="grid w-fit grid-cols-[6rem_repeat(3,minmax(5rem,1fr))] items-center gap-3">
			<div></div>
			{#each KBD_TONES as tone (tone)}
				<div class="text-center text-xs text-muted-foreground">{tone}</div>
			{/each}
			{#each KBD_FORMATS as format (format)}
				<div class="text-xs text-muted-foreground">{format}</div>
				{#each KBD_TONES as tone (tone)}
					<div
						class={[
							'flex justify-center rounded-md p-3',
							tone === 'inverted'
								? 'bg-primary text-primary-foreground'
								: 'bg-surface',
						]}
					>
						<Kbd {...args} {format} {tone}>
							{#if format === 'lucide'}
								<CommandIcon />
							{:else}
								K
							{/if}
						</Kbd>
					</div>
				{/each}
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Single Key">
	{#snippet template(args: KbdProps)}
		<div class="grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each singleKeySamples as sample (sample.label)}
				<div
					class={[
						'flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2',
						sample.tone === 'inverted'
							? 'bg-primary text-primary-foreground'
							: 'bg-surface',
					]}
				>
					<span class="text-sm">{sample.label}</span>
					<Kbd {...args} format={sample.format} tone={sample.tone}>
						{@render keyContent(sample.content)}
					</Kbd>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Kbd.Group">
	{#snippet template(args: KbdProps)}
		<div class="grid max-w-3xl gap-3">
			<div
				class="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2"
			>
				<span class="text-sm text-muted-foreground">Open command palette</span>
				<KbdGroup>
					<Kbd {...args} format="lucide"><CommandIcon /></Kbd>
					<Kbd {...args}>K</Kbd>
				</KbdGroup>
			</div>
			<div
				class="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2"
			>
				<span class="text-sm text-muted-foreground">Run selected action</span>
				<KbdGroup>
					<Kbd {...args}>Ctrl</Kbd>
					<Kbd {...args} format="lucide"><CornerDownLeftIcon /></Kbd>
				</KbdGroup>
			</div>
			<div
				class="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2"
			>
				<span class="text-sm text-muted-foreground">Open project search</span>
				<KbdGroup>
					<Kbd {...args} format="mono" tone="accent">Ctrl</Kbd>
					<Kbd {...args} format="mono" tone="accent">Shift</Kbd>
					<Kbd {...args} format="mono" tone="accent">P</Kbd>
				</KbdGroup>
			</div>
			<div
				class="flex items-center justify-between gap-4 rounded-md bg-primary px-3 py-2 text-primary-foreground"
			>
				<span class="text-sm">Primary button hint</span>
				<Button intent="primary" class="pointer-events-none">
					Create
					<Kbd {...args} format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
				</Button>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Common Placements">
	{#snippet template(args: KbdProps)}
		<div class="grid max-w-4xl gap-8 md:grid-cols-2">
			<div class="flex flex-col gap-4">
				<p class="text-sm font-medium text-foreground">Input field hint</p>
				<div class="relative max-w-xs">
					<SearchIcon
						class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle"
					/>
					<Input class="pl-8 pr-16" placeholder="Search workspaces" />
					<KbdGroup class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
						<Kbd {...args} format="lucide"><CommandIcon /></Kbd>
						<Kbd {...args}>K</Kbd>
					</KbdGroup>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<p class="text-sm font-medium text-foreground">Button hint</p>
				<Button intent="primary" class="w-fit">
					Open
					<Kbd {...args} format="lucide" tone="inverted"><CornerDownLeftIcon /></Kbd>
				</Button>
				<Button intent="secondary" class="w-fit">
					Search
					<KbdGroup>
						<Kbd {...args} format="lucide"><CommandIcon /></Kbd>
						<Kbd {...args}>K</Kbd>
					</KbdGroup>
				</Button>
			</div>
		</div>
	{/snippet}
</Story>
