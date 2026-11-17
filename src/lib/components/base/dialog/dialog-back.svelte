<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ButtonProps } from '$lib/components/base/button/button_variants.js';
	import { cn } from '$lib/utils.js';
	import {
		overlayBackButtonClass,
		overlayBackButtonSurfaceClass,
		overlayBackIconClass,
	} from './dialog_close_button.js';

	let {
		ref = $bindable(null),
		label,
		class: className,
		...restProps
	}: Omit<
		ButtonProps,
		'children' | 'href' | 'intent' | 'size' | 'format' | 'surfaceClass' | 'aria-label'
	> & {
		/** Accessible name, such as „Zpět“. */
		label: string;
	} = $props();
</script>

<!-- Placed inside Dialog.Header, whose title then reserves the sticker's clearance on both sides. -->
<Button
	bind:ref
	intent="ghost"
	size="sm"
	format="icon"
	data-slot="dialog-back"
	class={cn(overlayBackButtonClass, className)}
	surfaceClass={overlayBackButtonSurfaceClass}
	{...restProps}
>
	<ArrowLeftIcon data-icon="inline-start" class={overlayBackIconClass} />
	<span class="sr-only">{label}</span>
</Button>
