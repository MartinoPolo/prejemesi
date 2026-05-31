<script lang="ts">
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
</script>

<Select.Root bind:value type="single">
	<Select.Trigger size="sm" class={cn('gap-1.5', className)}>
		<ArrowUpDownIcon class="size-3.5 text-muted-foreground" />
		<span class="text-muted-foreground">Řazení:</span>
		<span>{SORT_LABELS[value]}</span>
	</Select.Trigger>
	<Select.Content>
		<Select.Group>
			{#each options as option (option)}
				<Select.Item value={option} label={SORT_LABELS[option]} />
			{/each}
		</Select.Group>
	</Select.Content>
</Select.Root>
