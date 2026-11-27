<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';

	interface Props {
		open: boolean;
		onopenchange: (open: boolean) => void;
		title: string;
		description: string;
		confirmLabel: string;
		confirmDisabled: boolean;
		submitting: boolean;
		onconfirm: () => void;
		/** Returns to the mobile bulk actions sheet instead of only closing. */
		onback?: () => void;
		confirmButton?: HTMLButtonElement | null;
		children: Snippet;
	}

	let {
		open,
		onopenchange,
		title,
		description,
		confirmLabel,
		confirmDisabled,
		submitting,
		onconfirm,
		onback,
		confirmButton = $bindable(null),
		children,
	}: Props = $props();

	let viewportWidth = $state(1024);
	// A bottom sheet below the small breakpoint, a centred dialog above it.
	const mobile = $derived(viewportWidth < 640);
	const returnsToActions = $derived(mobile && onback !== undefined);
</script>

<svelte:window bind:innerWidth={viewportWidth} />

{#snippet actions()}
	<div
		class="flex shrink-0 flex-col-reverse gap-(--nested-control-gap) px-6 pb-3 sm:flex-row sm:justify-end sm:px-0 sm:pb-0"
	>
		<Button
			intent="outline"
			class="w-full sm:w-auto"
			disabled={submitting}
			onclick={() => (returnsToActions ? onback?.() : onopenchange(false))}
		>
			{returnsToActions ? m.gift_context_back() : m.cancel()}
		</Button>
		<Button
			bind:ref={confirmButton}
			intent="primary"
			class="w-full sm:w-auto"
			disabled={confirmDisabled}
			onclick={onconfirm}
		>
			{confirmLabel}
		</Button>
	</div>
{/snippet}

{#if mobile}
	<Sheet.Root {open} onOpenChange={onopenchange}>
		{#if open}
			<WishlistBottomSheet>
				<WishlistSheetHeader>
					<Sheet.Title>{title}</Sheet.Title>
					<Sheet.Description>{description}</Sheet.Description>
				</WishlistSheetHeader>
				<WishlistSheetBody>{@render children()}</WishlistSheetBody>
				{@render actions()}
			</WishlistBottomSheet>
		{/if}
	</Sheet.Root>
{:else}
	<Dialog.Root {open} onOpenChange={onopenchange}>
		<Dialog.Content size="sm">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.Description>{description}</Dialog.Description>
			</Dialog.Header>
			{@render children()}
			{@render actions()}
		</Dialog.Content>
	</Dialog.Root>
{/if}
