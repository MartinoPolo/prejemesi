<script lang="ts" generics="Value extends string">
	import type { Snippet } from 'svelte';
	import { Label } from '$lib/components/base/label/index.js';
	import * as SegmentedToggle from '$lib/components/derived/segmented-toggle/index.js';

	interface AppearanceOption {
		value: Value;
		label: string;
		disabled?: boolean;
	}

	interface WishlistAppearanceOptionRowProps {
		/** Prefix for the label id, unique per editor. */
		id: string;
		label: string;
		value: Value;
		options: readonly AppearanceOption[];
		onchange: (value: Value) => void;
		disabled?: boolean;
		/** Hint or notice under the options. */
		help?: Snippet;
	}

	let {
		id,
		label,
		value,
		options,
		onchange,
		disabled = false,
		help,
	}: WishlistAppearanceOptionRowProps = $props();

	function handleValueChange(nextValue: string) {
		const option = options.find((candidate) => candidate.value === nextValue);
		if (option !== undefined) {
			onchange(option.value);
		}
	}
</script>

<div
	class="flex flex-col gap-2 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-3"
>
	<Label id="{id}-label">{label}</Label>
	<div class="flex min-w-0 flex-col gap-1.5">
		<SegmentedToggle.Root
			{value}
			onValueChange={handleValueChange}
			{disabled}
			aria-labelledby="{id}-label"
			class="max-w-full flex-wrap self-start"
		>
			{#each options as option (option.value)}
				<SegmentedToggle.Item value={option.value} disabled={option.disabled}>
					{option.label}
				</SegmentedToggle.Item>
			{/each}
		</SegmentedToggle.Root>
		{@render help?.()}
	</div>
</div>
