<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button, type ButtonProps } from '$lib/components/base/button/index.js';
	import { cn } from '$lib/utils.js';

	interface Props extends Omit<ButtonProps, 'children' | 'intent' | 'surfaceClass'> {
		children: Snippet;
		surfaceClass?: string;
	}

	let { children, class: className, surfaceClass, ...props }: Props = $props();
</script>

<Button
	{...props}
	intent="ghost"
	class={cn('min-h-12 w-full', className)}
	surfaceClass={cn(
		'w-full justify-start gap-3 text-left [&>svg]:size-5 [&>svg]:shrink-0',
		surfaceClass,
	)}
>
	{@render children()}
</Button>
