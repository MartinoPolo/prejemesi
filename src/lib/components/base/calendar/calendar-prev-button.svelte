<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { buttonVariants, type ButtonIntent } from '$lib/components/base/button/index.js';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		intent = 'ghost',
		...restProps
	}: CalendarPrimitive.PrevButtonProps & {
		intent?: ButtonIntent;
	} = $props();
</script>

{#snippet Fallback()}
	<ChevronLeftIcon class={cn('size-4', className)} />
{/snippet}

<CalendarPrimitive.PrevButton
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
</CalendarPrimitive.PrevButton>
