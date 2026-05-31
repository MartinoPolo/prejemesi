<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
		BADGE_DOT_OPTIONS,
		BADGE_FORMATS,
		BADGE_SIZES,
		BADGE_STYLES,
		BADGE_TONES,
		Badge,
	} from '$lib/components/base/badge/index.js';

	const { Story } = defineMeta({
		title: 'Base/Badge',
		component: Badge,
		tags: ['autodocs'],
		argTypes: {
			tone: {
				control: 'select',
				options: [...BADGE_TONES],
			},
			format: {
				control: 'select',
				options: [...BADGE_FORMATS],
			},
			size: {
				control: 'select',
				options: [...BADGE_SIZES],
			},
			badgeStyle: {
				control: 'select',
				options: [...BADGE_STYLES],
			},
			dot: {
				control: 'select',
				options: [undefined, ...BADGE_DOT_OPTIONS],
			},
		},
	});
</script>

<script lang="ts">
	import type { BadgeProps } from '$lib/components/base/badge/badge_variants.js';
	import TagIcon from '@lucide/svelte/icons/tag';
	import CheckIcon from '@lucide/svelte/icons/circle-check';
	import AlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/circle-x';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

	let collapseDemoStates = $state<Record<string, boolean>>({
		success: false,
		danger: false,
		warning: false,
		info: false,
	});

	function toggleCollapse(tone: string) {
		collapseDemoStates[tone] = !collapseDemoStates[tone];
	}
</script>

<Story name="All Variants">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-8">
			{#each BADGE_STYLES as badgeStyle (badgeStyle)}
				<div class="flex flex-col gap-3">
					<p class="text-sm font-medium text-muted-foreground">{badgeStyle}</p>
					<div
						class="grid items-center gap-x-3 gap-y-2"
						style="grid-template-columns: 12rem repeat({BADGE_TONES.length}, minmax(0, 1fr))"
					>
						<div></div>
						{#each BADGE_TONES as tone (tone)}
							<div class="text-center text-xs text-muted-foreground">{tone}</div>
						{/each}
						{#each BADGE_SIZES as size (size)}
							{#each BADGE_FORMATS as format (format)}
								<div class="text-xs text-muted-foreground">{size} / {format}</div>
								{#each BADGE_TONES as tone (tone)}
									<div class="flex justify-center">
										<Badge {...args} {tone} {badgeStyle} {format} {size}
											>{tone}</Badge
										>
									</div>
								{/each}
								<div class="text-xs text-muted-foreground">
									{size} / {format} / icon
								</div>
								{#each BADGE_TONES as tone (tone)}
									<div class="flex justify-center">
										<Badge {...args} {tone} {badgeStyle} {format} {size}>
											{#snippet icon()}<TagIcon class="size-3" />{/snippet}
											{tone}
										</Badge>
									</div>
								{/each}
							{/each}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Default">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-wrap items-center gap-3">
			{#each BADGE_TONES as tone (tone)}
				<Badge {tone} {...args}>{tone}</Badge>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Dots">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-4">
			{#each BADGE_DOT_OPTIONS as dot (dot)}
				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium text-muted-foreground">{dot}</p>
					<div class="flex flex-wrap gap-2">
						{#each BADGE_TONES as tone (tone)}
							<Badge {tone} {dot} {...args}>{tone}</Badge>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="With Static Dot">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-wrap items-center gap-3">
			<Badge tone="success" dot="static" {...args}>Active</Badge>
			<Badge tone="danger" dot="static" {...args}>Error</Badge>
			<Badge tone="info" dot="static" {...args}>Info</Badge>
		</div>
	{/snippet}
</Story>

<Story name="With Pulsing Dot">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-wrap items-center gap-3">
			<Badge tone="success" dot="pulsing" {...args}>Live</Badge>
			<Badge tone="danger" dot="pulsing" {...args}>Critical</Badge>
			<Badge tone="warning" dot="pulsing" {...args}>Pending</Badge>
		</div>
	{/snippet}
</Story>

<Story name="With Icon">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-wrap items-center gap-3">
			{#each BADGE_TONES as tone (tone)}
				<Badge {tone} {...args}>
					{#snippet icon()}<TagIcon class="size-3" />{/snippet}
					{tone}
				</Badge>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Font">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-4">
			{#each BADGE_FORMATS as format (format)}
				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium text-muted-foreground">{format}</p>
					<div class="flex flex-wrap gap-2">
						{#each BADGE_TONES as tone (tone)}
							<Badge {tone} {format} {...args}>{tone}</Badge>
						{/each}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each BADGE_TONES as tone (tone)}
							<Badge {tone} {format} {...args}>
								{#snippet icon()}<TagIcon class="size-3" />{/snippet}
								{tone}
							</Badge>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Mono">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-wrap items-center gap-3">
			<Badge format="mono" {...args}>v2.1.0</Badge>
			<Badge format="mono" {...args}>GET</Badge>
			<Badge format="mono" {...args}>200</Badge>
		</div>
	{/snippet}
</Story>

<Story name="Collapsible">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-6">
			<p class="text-xs text-muted-foreground">
				Click badges to toggle collapse/expand animation
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<button type="button" onclick={() => toggleCollapse('success')}>
					<Badge tone="success" collapsed={collapseDemoStates.success} {...args}>
						{#snippet icon()}<CheckIcon class="size-3" />{/snippet}
						Passed
					</Badge>
				</button>
				<button type="button" onclick={() => toggleCollapse('danger')}>
					<Badge tone="danger" collapsed={collapseDemoStates.danger} {...args}>
						{#snippet icon()}<XIcon class="size-3" />{/snippet}
						Failed
					</Badge>
				</button>
				<button type="button" onclick={() => toggleCollapse('warning')}>
					<Badge tone="warning" collapsed={collapseDemoStates.warning} {...args}>
						{#snippet icon()}<AlertIcon class="size-3" />{/snippet}
						Warning
					</Badge>
				</button>
				<button type="button" onclick={() => toggleCollapse('info')}>
					<Badge tone="info" collapsed={collapseDemoStates.info} {...args}>
						{#snippet icon()}<LoaderCircleIcon class="size-3 animate-spin" />{/snippet}
						Running
					</Badge>
				</button>
			</div>
			<div class="flex flex-col gap-2">
				<p class="text-xs font-medium text-muted-foreground">Always collapsed</p>
				<div class="flex flex-wrap items-center gap-3">
					<Badge tone="success" collapsed>
						{#snippet icon()}<CheckIcon class="size-3" />{/snippet}
						Passed
					</Badge>
					<Badge tone="danger" collapsed>
						{#snippet icon()}<XIcon class="size-3" />{/snippet}
						Failed
					</Badge>
					<Badge tone="warning" collapsed>
						{#snippet icon()}<AlertIcon class="size-3" />{/snippet}
						Warning
					</Badge>
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<p class="text-xs font-medium text-muted-foreground">Always expanded</p>
				<div class="flex flex-wrap items-center gap-3">
					<Badge tone="success">
						{#snippet icon()}<CheckIcon class="size-3" />{/snippet}
						Passed
					</Badge>
					<Badge tone="danger">
						{#snippet icon()}<XIcon class="size-3" />{/snippet}
						Failed
					</Badge>
					<Badge tone="info">
						{#snippet icon()}<LoaderCircleIcon class="size-3 animate-spin" />{/snippet}
						Running
					</Badge>
				</div>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Badge Styles (A/B/C)">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-4">
			{#each BADGE_STYLES as style (style)}
				<div class="flex flex-col gap-2">
					<p class="text-sm font-medium text-muted-foreground">{style}</p>
					<div class="flex flex-wrap gap-2">
						{#each BADGE_TONES as tone (tone)}
							<Badge {...args} {tone} badgeStyle={style}>{tone}</Badge>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>
