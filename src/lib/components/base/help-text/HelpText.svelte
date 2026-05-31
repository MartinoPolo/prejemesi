<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { helpTextVariants, type HelpTextProps } from './help_text_variants.js';

	let {
		ref = $bindable(null),
		state = 'default',
		class: className,
		children,
		...restProps
	}: HelpTextProps = $props();
</script>

<p
	bind:this={ref}
	data-slot="help-text"
	data-state={state}
	class={cn(helpTextVariants({ state }), className)}
	{...restProps}
>
	{@render children?.()}
</p>
