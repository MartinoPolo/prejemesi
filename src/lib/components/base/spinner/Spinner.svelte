<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { spinnerVariants, type SpinnerProps } from './spinner_variants.js';

	let { class: className, size = 'md', label, ...restProps }: SpinnerProps = $props();
</script>

<svg
	data-slot="spinner"
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="3"
	stroke-linecap="round"
	class={cn(spinnerVariants({ size }), className)}
	role={label === undefined ? undefined : 'img'}
	aria-label={label}
	aria-hidden={label === undefined ? 'true' : undefined}
	{...restProps}
>
	<circle cx="12" cy="12" r="9.5" stroke-opacity="0.35" />
	<path d="M5.282 5.282a9.5 9.5 0 0 1 13.436 0" />
</svg>
