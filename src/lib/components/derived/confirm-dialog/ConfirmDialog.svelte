<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Dialog as DialogPrimitive } from 'bits-ui';
	import { asExhaustiveArray } from '$lib/utils/variants.js';

	/**
	 * The confirm button's intent, picked by the action's consequence: `primary-destructive` when it
	 * cannot be undone, `danger` when it can be undone or only discards a draft, `primary` when safe.
	 */
	export type ConfirmIntent = 'primary-destructive' | 'danger' | 'primary';

	export const CONFIRM_INTENTS = asExhaustiveArray<ConfirmIntent>()([
		'primary-destructive',
		'danger',
		'primary',
	]);

	export interface ConfirmDialogProps extends Omit<
		DialogPrimitive.ContentProps,
		'children' | 'child' | 'title'
	> {
		open?: boolean;
		title: string;
		description: string;
		confirmLabel: string;
		confirmIntent: ConfirmIntent;
		/** Defaults to „Zrušit“. */
		cancelLabel?: string;
		/** Replaces the confirm label while the action runs. */
		pendingLabel?: string;
		/** Locks the dialog while a caller-owned action runs; an async `onconfirm` locks it too. */
		pending?: boolean;
		/** The dialog stays open; the caller closes it once the action succeeds. */
		onconfirm: () => unknown;
		/** Runs when the dialog closes without confirming (cancel, close button, Escape, outside). */
		oncancel?: () => void;
		/** Extra body content between the description and the actions. */
		children?: Snippet;
	}
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		confirmIntent,
		cancelLabel = m.cancel(),
		pendingLabel,
		pending = false,
		onconfirm,
		oncancel,
		children,
		...contentProps
	}: ConfirmDialogProps = $props();

	let confirmRunning = $state(false);
	const busy = $derived(pending || confirmRunning);

	function requestOpenChange(nextOpen: boolean) {
		if (busy) {
			return;
		}
		open = nextOpen;
		if (!nextOpen) {
			oncancel?.();
		}
	}

	async function confirm() {
		if (busy) {
			return;
		}
		confirmRunning = true;
		try {
			await onconfirm();
		} finally {
			confirmRunning = false;
		}
	}
</script>

<Dialog.Root bind:open={() => open, requestOpenChange}>
	<Dialog.Content size="md" showCloseButton={!busy} {...contentProps}>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		{@render children?.()}
		<Dialog.Footer>
			<Button intent="outline" disabled={busy} onclick={() => requestOpenChange(false)}>
				{cancelLabel}
			</Button>
			<Button
				intent={confirmIntent}
				disabled={busy}
				aria-busy={busy}
				onclick={() => void confirm()}
			>
				{#if busy}
					<Spinner data-icon="inline-start" />
					{pendingLabel ?? confirmLabel}
				{:else}
					{confirmLabel}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
