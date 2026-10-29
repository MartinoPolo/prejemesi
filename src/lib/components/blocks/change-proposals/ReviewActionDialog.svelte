<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ButtonIntent } from '$lib/components/base/button/index.js';

	/** Confirms one review action; it stays open and locked while the action runs. */
	let {
		open = $bindable(false),
		pending,
		title,
		description,
		cancelLabel,
		confirmLabel,
		pendingLabel,
		confirmIntent,
		confirmIcon: ConfirmIcon,
		testId,
		onconfirm,
		children,
	}: {
		open?: boolean;
		pending: boolean;
		title: string;
		description: string;
		cancelLabel: string;
		confirmLabel: string;
		pendingLabel: string;
		confirmIntent: ButtonIntent;
		confirmIcon?: Component;
		testId: string;
		onconfirm: () => void;
		children?: Snippet;
	} = $props();
</script>

<Dialog.Root
	bind:open={
		() => open,
		(nextOpen) => {
			if (!pending) {
				open = nextOpen;
			}
		}
	}
>
	<Dialog.Content size="md" showCloseButton={false} data-testid={testId}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description class="text-(length:--text-base) text-foreground">
				{description}
			</Dialog.Description>
		</Dialog.Header>
		{@render children?.()}
		<Dialog.Footer>
			<Button intent="secondary" disabled={pending} onclick={() => (open = false)}>
				{cancelLabel}
			</Button>
			<Button intent={confirmIntent} disabled={pending} onclick={onconfirm}>
				{#if pending}
					<LoaderIcon class="animate-spin" data-icon="inline-start" />{pendingLabel}
				{:else}
					{#if ConfirmIcon !== undefined}<ConfirmIcon data-icon="inline-start" />{/if}
					{confirmLabel}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
