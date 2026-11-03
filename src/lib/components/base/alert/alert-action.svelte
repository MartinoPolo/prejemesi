<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { alertActionVariants, type AlertActionPlacement } from './alert_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		placement = 'end',
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/** `end` beside a short message (Retry), `below` under a longer explanation it acts on. */
		placement?: AlertActionPlacement;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-action"
	data-placement={placement}
	class={cn(alertActionVariants({ placement }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
