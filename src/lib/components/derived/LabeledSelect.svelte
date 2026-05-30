<script lang="ts">
	import { browser } from '$app/environment';
	import * as Select from '$lib/components/base/select/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import type { Snippet } from 'svelte';

	interface SelectOption {
		readonly value: string;
		readonly label: string;
		readonly disabled?: boolean;
	}

	interface Props {
		label: string;
		options: readonly SelectOption[];
		value: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
		class?: string;
		triggerClass?: string;
		customItems?: Snippet;
	}

	let {
		label: labelText,
		options,
		value,
		onValueChange,
		placeholder = 'Select\u2026',
		class: className,
		triggerClass = 'w-full',
		customItems,
	}: Props = $props();

	const triggerText = $derived(
		browser ? (options.find((o) => o.value === value)?.label ?? placeholder) : '\u00A0',
	);
</script>

<div class="space-y-2 {className ?? ''}">
	<Label>{labelText}</Label>
	{#if browser}
		<Select.Root type="single" {value} {onValueChange}>
			<Select.Trigger class={triggerClass}>{triggerText}</Select.Trigger>
			<Select.Content>
				{#if customItems}
					{@render customItems()}
				{:else}
					{#each options as opt (opt.value)}
						<Select.Item value={opt.value} label={opt.label} disabled={opt.disabled}>
							{opt.label}
						</Select.Item>
					{/each}
				{/if}
			</Select.Content>
		</Select.Root>
	{:else}
		<Skeleton class="h-9 w-full rounded-md" />
	{/if}
</div>
