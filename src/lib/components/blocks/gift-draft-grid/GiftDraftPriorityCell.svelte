<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { cn } from '$lib/utils.js';
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

	function toggle() {
		onchange(isHigh ? DRAFT_PRIORITY.medium : DRAFT_PRIORITY.high);
	}
</script>

<!-- Heart toggle styled like a checkbox: checked = high (filled red), unchecked = medium (empty). -->
<button
	type="button"
	role="checkbox"
	aria-checked={isHigh}
	onclick={toggle}
	title={isHigh ? m.draft_grid_priority_high() : m.draft_grid_priority_medium()}
	aria-label={name.trim() === ''
		? m.draft_grid_priority_toggle_unnamed()
		: m.draft_grid_priority_toggle({ name })}
	class={cn(
		'border-input bg-input-surface focus-visible:border-ring focus-visible:ring-ring/50 flex size-7 shrink-0 items-center justify-center rounded-[6px] border shadow-xs outline-none transition-colors hover:border-[color-mix(in_oklch,var(--destructive)_50%,var(--border))] focus-visible:ring-3',
		isHigh ? 'text-destructive' : 'text-foreground-muted',
	)}
>
	<HeartIcon class={cn('size-4', isHigh && 'fill-current')} aria-hidden="true" />
</button>
