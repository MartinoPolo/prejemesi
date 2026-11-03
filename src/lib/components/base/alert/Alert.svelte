<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { ALERT_TONE_ROLES, alertVariants, type AlertProps } from './alert_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		tone = 'info',
		children,
		...restProps
	}: AlertProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	role={ALERT_TONE_ROLES[tone]}
	class={cn(alertVariants({ tone }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
