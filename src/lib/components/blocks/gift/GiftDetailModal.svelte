<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn } from '$lib/utils.js';
	import {
		overlayCloseButtonClass,
		overlayCloseButtonSurfaceClass,
	} from '$lib/components/base/dialog/dialog_close_button.js';
	import {
		giftDetailModalVariants,
		type GiftDetailModalMode,
	} from './gift_detail_modal_variants.js';
	import type {
		GiftByRole,
		GiftForVisitor,
		CreateGiftInput,
		UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import GiftDetailForm from './GiftDetailForm.svelte';
	import GiftDetailView from './GiftDetailView.svelte';

	interface Props {
		open: boolean;
		mode: GiftDetailModalMode;
		gift?: GiftByRole | null;
		wishlistId: string;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		/** Viewer role drives reservation-safe read-only and editable manager actions. */
		role?: WishlistRole;
		/** Visitors/non-managers (issue #125): renders the read-only {@link GiftDetailView} instead of the edit form. */
		readOnly?: boolean;
		/** Archived wishlist (issue #165): the read-only view's reserve action hides
		 *  unless the viewer already holds a reservation (cancel-only), mirroring cards. */
		isArchived?: boolean;
		hideReservationState?: boolean;
		postShareLocked?: boolean;
		canDelete?: boolean;
		graceExpiresAt?: Date | null;
		graceMessage?: (inputs: { time: string }) => string;
		graceNow?: Date;
		isSubmitting?: boolean;
		isDeleting?: boolean;
		oncreate?: (input: CreateGiftInput) => boolean | void | Promise<boolean | void>;
		onupdate?: (input: UpdateGiftInput) => boolean | void | Promise<boolean | void>;
		ondelete?: (giftId: string) => void | Promise<void>;
		/** Read-only view's inline reserve/like action bar (issue #165): opens the
		 *  reserve modal / cancels an existing reservation. */
		onreserve?: (gift: GiftForVisitor) => void;
		onunreserve?: (gift: GiftForVisitor) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		mode,
		gift = null,
		wishlistId,
		priorityLevels,
		categoryOptions = [],
		role = 'visitor',
		readOnly = false,
		isArchived = false,
		hideReservationState = false,
		postShareLocked = false,
		canDelete = true,
		graceExpiresAt = null,
		graceMessage = m.gift_grace_hint,
		graceNow = new Date(),
		isSubmitting = false,
		isDeleting = false,
		oncreate,
		onupdate,
		ondelete,
		onreserve,
		onunreserve,
		onclose,
	}: Props = $props();

	let contentRef = $state<HTMLDivElement | null>(null);
	let formDirty = $state(false);
	let formPending = $state(false);
	let guardOpen = $state(false);
	let pendingAction = $state<null | (() => void)>(null);
	let allowNavigation = false;
	// svelte-ignore state_referenced_locally (identity baseline; the effect below tracks changes)
	let formIdentity = $state(`${mode}:${gift?.id ?? 'new'}`);

	const styles = giftDetailModalVariants();
	const isEdit = $derived(mode === 'edit');
	const title = $derived(
		readOnly ? m.gift_detail_view_title() : isEdit ? m.gift_edit_title() : m.gift_add_title(),
	);

	const mutationPending = $derived(isSubmitting || isDeleting || formPending);

	function requestGuarded(action: () => void) {
		if (mutationPending) {
			return;
		}
		if (!formDirty) {
			action();
			return;
		}
		pendingAction = action;
		guardOpen = true;
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

	function continueEditing() {
		guardOpen = false;
		pendingAction = null;
		open = true;
	}

	function discardAndContinue() {
		if (mutationPending) {
			return;
		}
		const action = pendingAction;
		guardOpen = false;
		pendingAction = null;
		formDirty = false;
		action?.();
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
			guardOpen = false;
			pendingAction = null;
		}
	});
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange} onOpenChangeComplete={handleOpenChangeComplete}>
	<Dialog.Content
		bind:ref={contentRef}
		class={cn(styles.content(), !readOnly && 'max-sm:[&>[data-slot=dialog-close]]:hidden')}
		showCloseButton={true}
		onEscapeKeydown={handleDismiss}
		onInteractOutside={handleDismiss}
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			contentRef?.focus({ preventScroll: true });
		}}
	>
		{#if readOnly}
			<Dialog.Title class="sr-only">{title}</Dialog.Title>
		{:else}
			<div class={styles.editorHeader()} data-testid="gift-editor-header">
				<Dialog.Title class={styles.editorTitle()}>{title}</Dialog.Title>
				<Button
					intent="ghost"
					size="sm"
					format="icon"
					class={cn(overlayCloseButtonClass, 'static shrink-0 sm:hidden')}
					surfaceClass={overlayCloseButtonSurfaceClass}
					onclick={() => handleOpenChange(false)}
				>
					<XIcon data-icon="solo" />
					<span class="sr-only">{m.close()}</span>
				</Button>
			</div>
		{/if}
		<Dialog.Description class="sr-only">
			{readOnly
				? m.gift_detail_view_description()
				: isEdit
					? m.gift_edit_description()
					: m.gift_add_description()}
		</Dialog.Description>

		{#if readOnly && gift !== null}
			<GiftDetailView
				{gift}
				{role}
				{isArchived}
				{hideReservationState}
				{onreserve}
				{onunreserve}
			/>
		{:else}
			<!-- The form seeds its field state once at mount (deliberately non-reactive), so a
			     mode/gift swap while it stays mounted would submit the previous gift's typed
			     values under the new gift's id. Keying by identity forces a remount + reseed,
			     making that cross-gift write structurally impossible (incident 2026-08-04). -->
			{#key `${mode}:${gift?.id ?? 'new'}`}
				<GiftDetailForm
					{mode}
					{gift}
					{wishlistId}
					{priorityLevels}
					{categoryOptions}
					{role}
					{hideReservationState}
					{postShareLocked}
					{canDelete}
					{graceExpiresAt}
					{graceMessage}
					{graceNow}
					{isSubmitting}
					{isDeleting}
					{oncreate}
					{onupdate}
					{ondelete}
					oncancel={() => handleOpenChange(false)}
					ondirtychange={(dirty) => (formDirty = dirty)}
					onpendingchange={(pending) => (formPending = pending)}
					onsavesuccess={closeAfterSave}
				/>
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={guardOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_settings_unsaved_title()}</Dialog.Title>
			<Dialog.Description>{m.gift_unsaved_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex flex-wrap gap-2">
			<Button intent="outline" onclick={continueEditing}>
				{m.wishlist_settings_continue_editing()}
			</Button>
			<Button intent="danger" onclick={discardAndContinue} disabled={mutationPending}>
				{m.wishlist_settings_discard()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
