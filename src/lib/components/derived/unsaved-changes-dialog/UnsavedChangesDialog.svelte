<script lang="ts" module>
	export interface UnsavedChangesDialogProps {
		open?: boolean;
		/** Defaults to the generic save, discard or continue editing prompt. */
		description?: string;
		/** Locks the dialog while a caller-owned save runs; an async `onsave` locks it too. */
		saving?: boolean;
		/** Blocks saving while the editor itself cannot save, such as during an image upload. */
		saveDisabled?: boolean;
		/** Saves the edits; the caller continues the interrupted action only after success. */
		onsave: () => unknown;
		ondiscard: () => void;
		/** Runs on „Pokračovat v úpravách“, the close button, Escape and an outside press. */
		oncontinue: () => void;
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
		description = m.unsaved_changes_description(),
		saving = false,
		saveDisabled = false,
		onsave,
		ondiscard,
		oncontinue,
	}: UnsavedChangesDialogProps = $props();

	let contentRef = $state<HTMLElement | null>(null);
	const lock = createDialogActionLock({ pending: () => saving, content: () => contentRef });
	const busy = $derived(lock.busy);

	function requestOpenChange(nextOpen: boolean) {
		if (busy || nextOpen) {
			return;
		}
		oncontinue();
	}

	function save() {
		if (!saveDisabled) {
			void lock.run(onsave);
		}
	}
</script>

<!-- lg keeps all three actions on one row on desktop; phones stack them with Save on top. -->
<Dialog.Root bind:open={() => open, requestOpenChange}>
	<Dialog.Content
		bind:ref={contentRef}
		size="lg"
		showCloseButton={!busy}
		data-testid="unsaved-changes-dialog"
	>
		<Dialog.Header>
			<Dialog.Title>{m.unsaved_changes_title()}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button intent="outline" disabled={busy} onclick={oncontinue}>
				{m.unsaved_changes_continue_editing()}
			</Button>
			<Button intent="danger" disabled={busy} onclick={ondiscard}>
				{m.unsaved_changes_discard()}
			</Button>
			<Button
				intent="primary"
				disabled={busy || saveDisabled}
				aria-busy={busy}
				onclick={save}
			>
				{#if busy}<Spinner data-icon="inline-start" />{/if}
				{m.unsaved_changes_save_continue()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
