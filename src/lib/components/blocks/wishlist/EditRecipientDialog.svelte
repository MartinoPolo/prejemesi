<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import {
		flipRecipientToFreeText,
		renameRecipient,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { RECIPIENT_NAME_MAX_LENGTH } from '$lib/modules/wishlists/types.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import RecipientPreview from './RecipientPreview.svelte';

	interface EditRecipientDialogProps {
		open: boolean;
		wishlistId: string;
		/** True when the list has a linked recipient account — the dialog performs the one-way
		 *  linked → free-text flip (issue #150, linked recipient only). False = free-text
		 *  rename (any správce, rules unchanged). */
		isLinkedRecipient: boolean;
		/** Current recipient display name; prefills the rename input (the flip starts empty,
		 *  the new free-text recipient is someone else, e.g. a child). */
		recipientDisplayName: string;
		/** Shared lists notify followers on flip — drives the consequence line. */
		isShared: boolean;
		/** Awaited before the dialog closes. The mutation itself single-flight-refreshes the
		 *  wishlist page query and, for the flip, the Moje seznamy/Spravované dashboards
		 *  (issue #108) — this callback is a hook for callers that need extra work, not for
		 *  refreshing data. */
		onchanged: () => Promise<void>;
	}

	let {
		open = $bindable(false),
		wishlistId,
		isLinkedRecipient,
		recipientDisplayName,
		isShared,
		onchanged,
	}: EditRecipientDialogProps = $props();

	let nameDraft = $state('');
	let isSaving = $state(false);

	const trimmedName = $derived(nameDraft.trim());

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (trimmedName === '' || isSaving) {
			return;
		}
		isSaving = true;
		try {
			if (isLinkedRecipient) {
				await flipRecipientToFreeText({ id: wishlistId, recipientName: trimmedName });
				toastSuccess(m.recipient_flip_toast_success());
			} else {
				await renameRecipient({ id: wishlistId, recipientName: trimmedName });
				toastSuccess(m.recipient_rename_toast_success());
			}
			await onchanged();
			open = false;
		} catch (thrown) {
			toastError(
				translateServerError(
					thrown,
					isLinkedRecipient ? m.recipient_flip_error() : m.recipient_rename_error(),
				),
			);
		} finally {
			isSaving = false;
		}
	}

	// Re-seed the input each time the dialog opens: rename starts from the current name,
	// the flip starts empty (the new recipient is someone else than the account holder).
	$effect(() => {
		if (open) {
			nameDraft = isLinkedRecipient ? '' : recipientDisplayName;
		}
	});
</script>

<!-- Shared recipient dialog (issue #150): opened from the header pencil and the settings
     modal recipient row. On linked lists it spells out the flip consequences before the
     one-way conversion; on free-text lists it is a plain rename. -->
<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{isLinkedRecipient
					? m.recipient_flip_dialog_title()
					: m.recipient_rename_dialog_title()}
			</Dialog.Title>
		</Dialog.Header>

		{#if isLinkedRecipient}
			<Alert.Root tone="warning">
				<TriangleAlertIcon />
				<Alert.Description data-testid="recipient-flip-consequences">
					{m.recipient_flip_dialog_consequences()}
					{#if isShared}
						{m.recipient_flip_dialog_followers_notice()}
					{/if}
					{m.recipient_flip_dialog_permanent()}
				</Alert.Description>
			</Alert.Root>
		{/if}

		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="edit-recipient-name">{m.recipient_rename_label()}</Label>
				<Input
					id="edit-recipient-name"
					bind:value={nameDraft}
					placeholder={m.create_recipient_name_placeholder()}
					maxlength={RECIPIENT_NAME_MAX_LENGTH}
					required
					disabled={isSaving}
				/>
				<RecipientPreview name={nameDraft} />
			</div>
			<Dialog.Footer class="flex gap-2">
				<Button
					type="button"
					intent="outline"
					onclick={() => (open = false)}
					disabled={isSaving}
				>
					{m.cancel()}
				</Button>
				<Button type="submit" disabled={isSaving || trimmedName === ''}>
					{#if isSaving}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
					{/if}
					{isLinkedRecipient
						? m.recipient_flip_confirm_button()
						: m.recipient_rename_button()}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
