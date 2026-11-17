<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import * as Select from '$lib/components/base/select/index.js';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { SORT_LABELS, type SortOption } from '$lib/modules/wishlists/dashboard_types.js';

	interface SortDropdownProps {
		value: SortOption;
		/** Subset of sort options to show */
		options?: SortOption[];
		class?: string;
	}

	let {
		value = $bindable(),
		options = ['lastActivity', 'alphabetical', 'dateCreated', 'eventDate'],
		class: className,
	}: SortDropdownProps = $props();

	const triggerLabelId = $props.id();
</script>

<Select.Root bind:value type="single">
	<!-- A combobox takes no name from its content, so the visible label and value name it. -->
	<Select.Trigger
		class={cn('min-w-0 max-w-full gap-1.5', className)}
		aria-labelledby={triggerLabelId}
	>
		<ArrowUpDownIcon class="size-3.5 shrink-0 text-muted-foreground" />
		<span id={triggerLabelId} class="min-w-0 truncate">
			<span class="text-muted-foreground">{m.dashboard_sort_label()}</span>
			{SORT_LABELS[value]()}
		</span>
	</Select.Trigger>
	<Select.Content>
		<Select.Group>
			{#each options as option (option)}
				<Select.Item value={option} label={SORT_LABELS[option]()} />
			{/each}
		</Select.Group>
	</Select.Content>
</Select.Root>
