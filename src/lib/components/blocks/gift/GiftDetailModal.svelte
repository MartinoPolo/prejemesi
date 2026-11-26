<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import {
		createUnsavedChangesGuard,
		UnsavedChangesDialog,
	} from '$lib/components/derived/unsaved-changes-dialog/index.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import type {
		GiftByRole,
		GiftForVisitor,
		GiftUnreserveHandler,
		CreateGiftInput,
		UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftDetailForm from './GiftDetailForm.svelte';
	import GiftViewer from './GiftViewer.svelte';
	import type { GiftMoreProps } from '$lib/components/blocks/wishlist/gift_context_invocation.js';
	import { giftViewerVariants } from './gift_viewer_variants.js';

	interface Props extends GiftMoreProps {
		open: boolean;
		mode: GiftDetailModalMode;
		gift?: GiftByRole | null;
		wishlistId: string;
		demo?: boolean;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		/** Offers creating a category from the editor's category select. */
		canCreateCategory?: boolean;
		/** Viewer role drives reservation-safe read-only and editable manager actions. */
		role?: WishlistRole;
		/** Viewers without edit rights get the read-only {@link GiftViewer} instead of the edit form. */
		readOnly?: boolean;
		/** Archived wishlist: the viewer's reserve action hides unless the viewer already holds a
		 *  reservation (cancel-only), mirroring cards. */
		isArchived?: boolean;
		hideReservationState?: boolean;
		postShareLocked?: boolean;
		/** Title of the shared linked copy whose list froze the name, when that copy froze it. */
		frozenByLinkedCopyTitle?: string | null;
		canDelete?: boolean;
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		graceNow?: Date;
		/** Asked before the first change to an existing gift; false reverts that change. */
		confirmChange?: () => Promise<boolean>;
		isSubmitting?: boolean;
		isDeleting?: boolean;
		oncreate?: (input: CreateGiftInput) => boolean | void | Promise<boolean | void>;
		onupdate?: (input: UpdateGiftInput) => boolean | void | Promise<boolean | void>;
		ondelete?: (giftId: string) => void | Promise<void>;
		/** Gift viewer reservation action: opens the reserve modal / cancels an existing reservation. */
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: GiftUnreserveHandler;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		mode,
		gift = null,
		wishlistId,
		demo = false,
		priorityLevels,
		categoryOptions = [],
		canCreateCategory = false,
		role = 'visitor',
		readOnly = false,
		isArchived = false,
		hideReservationState = false,
		postShareLocked = false,
		frozenByLinkedCopyTitle = null,
		canDelete = true,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		confirmChange,
		isSubmitting = false,
		isDeleting = false,
		oncreate,
		onupdate,
		ondelete,
		onreserve,
		onunreserve,
		onmore,
		moreOpen,
		moreSurface,
		onclose,
	}: Props = $props();

	let contentRef = $state<HTMLDivElement | null>(null);
	let formDirty = $state(false);
	let formPending = $state(false);
	let changeConfirmationPending = false;
	// Remounting the form is what reverts a change the user declined to confirm.
	let formRevision = $state(0);
	let form = $state<ReturnType<typeof GiftDetailForm>>();
	let allowNavigation = false;
	// svelte-ignore state_referenced_locally (identity baseline; the effect below tracks changes)
	let formIdentity = $state(`${mode}:${gift?.id ?? 'new'}`);

	const styles = giftDetailModalVariants();
	const viewerStyles = giftViewerVariants();
	const isEdit = $derived(mode === 'edit');
	const isViewer = $derived(readOnly && gift !== null);
	// A viewer needs a gift: without one, open nothing rather than the editor's add chrome.
	const hasDialogContent = $derived(!readOnly || gift !== null);
	const contentClass = $derived(isViewer ? viewerStyles.dialog() : styles.content());
	const description = $derived(
		readOnly
			? m.gift_viewer_description()
			: isEdit
				? m.gift_edit_description()
				: m.gift_add_description(),
	);

	const mutationPending = $derived(isSubmitting || isDeleting || formPending);

	/** Only a successful footer Save continues; a failure keeps the editor open with its
	 *  validation errors or the save error toast. */
	const unsavedChangesGuard = createUnsavedChangesGuard({
		isDirty: () => formDirty,
		save: async () => (await form?.submit()) ?? false,
		discard: () => (formDirty = false),
		continueEditing: () => (open = true),
	});

	function requestGuarded(action: () => void) {
		if (mutationPending) {
			return;
		}
		unsavedChangesGuard.request(action);
	}

	function handleOpenChange(newOpen: boolean) {
		if (newOpen) {
			open = true;
			return;
		}
		if (readOnly) {
			open = false;
			return;
		}
		requestGuarded(() => (open = false));
	}

	function handleDismiss(event: Event) {
		if (readOnly || (!mutationPending && !formDirty)) {
			return;
		}
		event.preventDefault();
		requestGuarded(() => (open = false));
	}

	function handleEscapeKeydown(event: KeyboardEvent) {
		if (!readOnly && form?.leaveStepOnEscape() === true) {
			event.preventDefault();
			return;
		}
		handleDismiss(event);
	}

	function handleFormDirtyChange(dirty: boolean) {
		formDirty = dirty;
		if (dirty && isEdit && confirmChange !== undefined && !changeConfirmationPending) {
			void confirmFirstChange(confirmChange);
		}
	}

	async function confirmFirstChange(confirm: () => Promise<boolean>) {
		changeConfirmationPending = true;
		try {
			if (!(await confirm())) {
				formDirty = false;
				formRevision += 1;
			}
		} finally {
			changeConfirmationPending = false;
		}
	}

	function closeAfterSave() {
		formDirty = false;
		open = false;
	}

	function handleOpenChangeComplete(completedOpen: boolean) {
		if (!completedOpen && !open) {
			onclose?.();
		}
	}

	beforeNavigate((navigation) => {
		if (!open || readOnly || (!formDirty && !mutationPending) || allowNavigation) {
			return;
		}
		navigation.cancel();
		if (mutationPending || navigation.to?.url === undefined) {
			return;
		}
		const destination = `${navigation.to.url.pathname}${navigation.to.url.search}${navigation.to.url.hash}`;
		requestGuarded(() => {
			allowNavigation = true;
			void goto(destination)
				.catch((thrown) => console.error('Failed to navigate from gift editor:', thrown))
				.finally(() => (allowNavigation = false));
		});
	});

	onMount(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!open || readOnly || (!formDirty && !mutationPending)) {
				return;
			}
			event.preventDefault();
			event.returnValue = true;
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	$effect(() => {
		const nextIdentity = `${mode}:${gift?.id ?? 'new'}`;
		if (nextIdentity !== formIdentity) {
			formIdentity = nextIdentity;
			formDirty = false;
			formPending = false;
			unsavedChangesGuard.cancel();
		}
	});
</script>

{#snippet editorForm()}
	<!-- The form seeds its field state once at mount (deliberately non-reactive), so a
	     mode/gift swap while it stays mounted would submit the previous gift's typed
	     values under the new gift's id. Keying by identity forces a remount + reseed,
	     making that cross-gift write structurally impossible (incident 2026-08-04). -->
	{#key `${mode}:${gift?.id ?? 'new'}:${formRevision}`}
		<GiftDetailForm
			bind:this={form}
			{mode}
			{gift}
			{wishlistId}
			{demo}
			{priorityLevels}
			{categoryOptions}
			{canCreateCategory}
			{role}
			{hideReservationState}
			{postShareLocked}
			{frozenByLinkedCopyTitle}
			{canDelete}
			{graceExpiresAt}
			{graceMessage}
			{graceNow}
			confirmChange={isEdit ? confirmChange : undefined}
			{isSubmitting}
			{isDeleting}
			{oncreate}
			{onupdate}
			{ondelete}
			oncancel={() => handleOpenChange(false)}
			ondirtychange={handleFormDirtyChange}
			onpendingchange={(pending) => (formPending = pending)}
			onsavesuccess={closeAfterSave}
		/>
	{/key}
{/snippet}

<!-- Keep the Root mounted even without a gift: its portal must enter body before later
     dialogs (the reserve form) so those equal-z-index layers stack above the viewer. -->
<Dialog.Root
	bind:open={() => open && hasDialogContent, handleOpenChange}
	onOpenChangeComplete={handleOpenChangeComplete}
>
	<Dialog.Content
		bind:ref={contentRef}
		class={contentClass}
		layout={isViewer ? 'default' : 'scroll'}
		showCloseButton={true}
		onEscapeKeydown={handleEscapeKeydown}
		onInteractOutside={handleDismiss}
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			contentRef?.focus({ preventScroll: true });
		}}
	>
		<Dialog.Description class="sr-only">{description}</Dialog.Description>

		{#if isViewer && gift !== null}
			<GiftViewer
				{gift}
				{role}
				{isArchived}
				{hideReservationState}
				{onreserve}
				{onunreserve}
				{onmore}
				{moreOpen}
				{moreSurface}
			/>
		{:else if !readOnly}
			{@render editorForm()}
		{/if}
	</Dialog.Content>
</Dialog.Root>

<UnsavedChangesDialog {...unsavedChangesGuard.dialogProps} saving={mutationPending} />
