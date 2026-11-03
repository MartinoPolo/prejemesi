<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Dialog as DialogPrimitive } from 'bits-ui';
	import { asExhaustiveArray } from '$lib/utils/variants.js';

	import type { DialogContentSize } from '$lib/components/base/dialog/dialog_variants.js';

	/**
	 * The confirm is the dialog's one solid button: `primary-destructive` when it discards or deletes
	 * anything, `primary` when it is safe.
	 */
	export type ConfirmIntent = 'primary-destructive' | 'primary';

	export const CONFIRM_INTENTS = asExhaustiveArray<ConfirmIntent>()([
		'primary-destructive',
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
		/** Widen past `md` when the title would otherwise wrap beside the close button. */
		size?: DialogContentSize;
	}
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { createDialogActionLock } from '$lib/components/base/dialog/dialog_action_lock.svelte.js';
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
		size = 'md',
		...contentProps
	}: ConfirmDialogProps = $props();

	let contentRef = $state<HTMLElement | null>(null);
	const lock = createDialogActionLock({ pending: () => pending, content: () => contentRef });
	const busy = $derived(lock.busy);

	function requestOpenChange(nextOpen: boolean) {
		if (busy) {
			return;
		}
		open = nextOpen;
		if (!nextOpen) {
			oncancel?.();
		}
	}
</script>

<Dialog.Root bind:open={() => open, requestOpenChange}>
	<Dialog.Content bind:ref={contentRef} {size} showCloseButton={!busy} {...contentProps}>
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
				onclick={() => void lock.run(onconfirm)}
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
