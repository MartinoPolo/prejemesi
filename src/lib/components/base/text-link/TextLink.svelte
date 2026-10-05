<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import { cn } from '$lib/utils.js';
	import { textLinkVariants, type TextLinkProps } from './text_link_variants.js';

	let {
		ref = $bindable(null),
		class: className,
		size = 'md',
		external = false,
		target,
		rel,
		children,
		...restProps
	}: TextLinkProps = $props();

	const styles = $derived(textLinkVariants({ size }));
	const rootClass = $derived(cn(styles.root(), className));
</script>

<a
	bind:this={ref}
	data-slot="text-link"
	{...restProps}
	class={rootClass}
	target={external ? '_blank' : target}
	rel={external ? 'external noopener noreferrer' : rel}
>
	<span class={styles.label()}>{@render children?.()}</span>
	{#if external}
		<ExternalLinkIcon class={styles.icon()} aria-hidden="true" />
	{/if}
</a>
