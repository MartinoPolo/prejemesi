<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import {
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
			size: {
				control: 'select',
				options: [...BADGE_SIZES],
			},
			badgeStyle: {
				control: 'select',
				options: [...BADGE_STYLES],
			},
		},
	});
</script>

<script lang="ts">
	import type { BadgeProps } from '$lib/components/base/badge/badge_variants.js';
	import TagIcon from '@lucide/svelte/icons/tag';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/circle-check';
	import AlertIcon from '@lucide/svelte/icons/triangle-alert';
</script>

<Story name="All Variants">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-8">
			{#each BADGE_STYLES as badgeStyle (badgeStyle)}
				<div class="flex flex-col gap-3">
					<p class="text-sm font-medium text-muted-foreground">{badgeStyle}</p>
					<div
						class="grid items-center gap-x-3 gap-y-2"
						style="grid-template-columns: 8rem repeat({BADGE_TONES.length}, minmax(0, 1fr))"
					>
						<div></div>
						{#each BADGE_TONES as tone (tone)}
							<div class="text-center text-xs text-muted-foreground">{tone}</div>
						{/each}
						{#each BADGE_SIZES as size (size)}
							<div class="text-xs text-muted-foreground">{size}</div>
							{#each BADGE_TONES as tone (tone)}
								<div class="flex justify-center">
									<Badge {...args} {tone} {badgeStyle} {size}>{tone}</Badge>
								</div>
							{/each}
							<div class="text-xs text-muted-foreground">{size} / icon</div>
							{#each BADGE_TONES as tone (tone)}
								<div class="flex justify-center">
									<Badge {...args} {tone} {badgeStyle} {size}>
										{#snippet icon()}<TagIcon class="size-3" />{/snippet}
										{tone}
									</Badge>
								</div>
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

<!-- lg matches Button `sm` metrics; icons use the data-icon convention (auto-sized to 3.5). -->
<Story name="Large">
	{#snippet template(args: BadgeProps)}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center gap-3">
				{#each BADGE_TONES as tone (tone)}
					<Badge {tone} size="lg" {...args}>{tone}</Badge>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Badge tone="info" size="lg" {...args}>
					<CalendarIcon data-icon="inline-start" />
					24. 12. 2026
				</Badge>
				<Badge tone="success" size="lg" {...args}>
					<CheckIcon data-icon="inline-start" />
					Aktivní
				</Badge>
				<Badge tone="warning" size="lg" {...args}>
					<AlertIcon data-icon="inline-start" />
					Za 3 dny
				</Badge>
			</div>
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
