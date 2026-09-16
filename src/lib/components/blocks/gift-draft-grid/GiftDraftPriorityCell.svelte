<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { Toggle } from '$lib/components/base/toggle/index.js';
	import { cn } from '$lib/utils.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { DRAFT_PRIORITY, type DraftPriority } from '$lib/modules/gifts/types.js';

	interface Props {
		priority: DraftPriority;
		/** Row name, woven into the aria-label so the control is distinguishable. */
		name?: string;
		onchange: (next: DraftPriority) => void;
	}

	let { priority, name = '', onchange }: Props = $props();

	const isHigh = $derived(priority === DRAFT_PRIORITY.high);

	function setHigh(pressed: boolean) {
		onchange(pressed ? DRAFT_PRIORITY.high : DRAFT_PRIORITY.medium);
	}
</script>

<!-- Heart toggle styled like a checkbox: checked = high (filled red), unchecked = medium (empty). -->
<SimpleTooltip
	text={isHigh ? m.draft_grid_priority_high() : m.draft_grid_priority_medium()}
	side="top"
>
	{#snippet asChild(triggerProps)}
		<Toggle
			{...triggerProps}
			pressed={isHigh}
			onPressedChange={setHigh}
			intent="default"
			size="sm"
			format="icon"
			role="checkbox"
			aria-checked={isHigh}
			aria-label={name.trim() === ''
				? m.draft_grid_priority_toggle_unnamed()
				: m.draft_grid_priority_toggle({ name })}
			surfaceClass={isHigh ? 'text-destructive' : 'text-muted-foreground'}
		>
			<HeartIcon data-icon="solo" class={cn(isHigh && 'fill-current')} aria-hidden="true" />
		</Toggle>
	{/snippet}
</SimpleTooltip>
