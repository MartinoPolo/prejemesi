<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import { cn } from '$lib/utils.js';
	import { checkboxVariants, type CheckboxSize } from './checkbox_variants.js';

	let {
		size,
		checked = false,
		indeterminate = false,
		disabled = false,
		class: className,
	}: {
		size?: CheckboxSize;
		checked?: boolean;
		indeterminate?: boolean;
		disabled?: boolean;
		class?: string;
	} = $props();

	const styles = $derived(checkboxVariants({ size: size ?? 'responsive' }));
</script>

<span
	data-slot="checkbox-surface"
	data-checked={checked || undefined}
	data-indeterminate={indeterminate || undefined}
	data-disabled={disabled || undefined}
	aria-hidden="true"
	class={cn(styles.surface(), className)}
>
	<span data-slot="checkbox-indicator" class={styles.indicator()}>
		{#if indeterminate}
			<MinusIcon data-icon />
		{:else if checked}
			<CheckIcon data-icon />
		{/if}
	</span>
</span>
