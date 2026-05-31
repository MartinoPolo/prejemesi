<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { buttonVariants, type ButtonIntent } from '$lib/components/base/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		intent = 'ghost',
		...restProps
	}: CalendarPrimitive.NextButtonProps & {
		intent?: ButtonIntent;
	} = $props();
</script>

{#snippet Fallback()}
	<ChevronRightIcon class={cn('size-4', className)} />
{/snippet}

<CalendarPrimitive.NextButton
	bind:ref
	class={cn(
		buttonVariants({ intent }),
		'size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50 rtl:rotate-180',
		className,
	)}
	{...restProps}
>
	{#if children}
		{@render children?.()}
	{:else}
		{@render Fallback()}
	{/if}
</CalendarPrimitive.NextButton>
