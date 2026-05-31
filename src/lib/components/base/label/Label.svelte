<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: LabelPrimitive.RootProps = $props();
</script>

<LabelPrimitive.Root
	bind:ref
	data-slot="label"
	class={cn(
		'flex items-center gap-2 text-(length:--text-sm) tracking-[0.01em] text-muted-foreground font-medium leading-none select-none group-data-[disabled=true]:opacity-50 group-data-[disabled=true]:pointer-events-none peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
		className,
	)}
	{...restProps}
/>
