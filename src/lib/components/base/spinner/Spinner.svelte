<script lang="ts">
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { cn } from '$lib/utils.js';
	import { spinnerVariants, type SpinnerProps } from './spinner_variants.js';

	let { class: className, size = 'md', label, ...restProps }: SpinnerProps = $props();
</script>

<LoaderIcon
	data-slot="spinner"
	class={cn(spinnerVariants({ size }), className)}
	role={label === undefined ? undefined : 'img'}
	aria-label={label}
	aria-hidden={label === undefined ? 'true' : undefined}
	{...restProps}
/>
