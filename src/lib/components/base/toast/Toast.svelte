<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { toastVariants, toastIconColors, type ToastProps } from './toast_variants.js';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/base/button/index.js';

	let {
		ref = $bindable<HTMLDivElement | null>(null),
		class: className,
		tone = 'info',
		title,
		body,
		icon,
		action,
		onDismiss,
		...restProps
	}: ToastProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="toast"
	data-tone={tone}
	role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
	aria-live={tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite'}
	class={cn(toastVariants({ tone }), className)}
	{...restProps}
>
	{#if icon}
		<div class={cn('shrink-0', toastIconColors[tone])}>
			{@render icon()}
		</div>
	{/if}

	<div class="min-w-0 flex-1">
		<div class="text-[12.5px] font-semibold text-foreground">{title}</div>
		{#if body}
			<div class="mt-0.5 text-(length:--text-sm) text-muted-foreground">{body}</div>
		{/if}
	</div>

	{#if action}
		{@render action()}
	{/if}

	{#if onDismiss}
		<Button
			intent="ghost"
			size="icon-sm"
			class="size-6 text-foreground-subtle"
			onclick={onDismiss}
			aria-label="Dismiss"
		>
			<XIcon data-icon="inline-start" />
		</Button>
	{/if}
</div>
