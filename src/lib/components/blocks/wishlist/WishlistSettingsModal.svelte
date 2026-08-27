<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as Tabs from '$lib/components/base/tabs/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import FileUpIcon from '@lucide/svelte/icons/file-up';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import WishlistCropEditor from './WishlistCropEditor.svelte';
	import WishlistPaletteAutoSave from './WishlistPaletteAutoSave.svelte';
	import WishlistCategorySettings from './WishlistCategorySettings.svelte';
	import RecipientPreview from './RecipientPreview.svelte';
	import {
		WISHLIST_SETTINGS_TABS,
		type WishlistSettingsTab,
	} from './wishlist_settings_modal_types.js';
	import {
		updateWishlist,
		deleteWishlist,
		renameRecipient,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { revertWishlistToDraft } from '$lib/modules/sharing/sharing.remote.js';
	import { graceWindowExpiresAt } from '$lib/modules/sharing/grace_window.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import {
		REVERT_CAPABILITY,
		type RevertCapability,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import {
		RECIPIENT_NAME_MAX_LENGTH,
		WISHLIST_TITLE_MAX_LENGTH,
		WISHLIST_ROLES,
		type Wishlist,
		type WishlistRole,
	} from '$lib/modules/wishlists/types.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';

	interface WishlistSettingsModalProps {
		open: boolean;
		/** Tab shown while the dialog is open; bindable so entry points can deep-link a tab. */
		activeTab: WishlistSettingsTab;
		wishlist: Wishlist;
		/** Recipient OR správce; non-managers get a read-only notice instead of the forms. */
		canManage: boolean;
		/** Viewer role: on linked lists only the linked recipient may edit the recipient (issue #150). */
		role: WishlistRole;
		/** Server-computed revert-to-draft affordance (issue #150): drives the danger-zone revert
		 *  action and — for an app admin who does not manage the list — the admin-only settings view. */
		revertCapability: RevertCapability;
		/** Who the list is for: linked account name or free-text name (shown in the recipient row). */
		recipientDisplayName: string;
		/** Theme-derived fallback emoji for the crop editor previews. */
		themeEmoji: string;
		/** Awaited page refresh after a save so the form can re-seed from fresh values. */
		onsaved: () => Promise<void>;
		/** Optimistic palette update so the page's data-palette subtree re-themes instantly. */
		onpaletteselect?: (palette: Palette) => void;
		/** Fires after a successful delete so the page can navigate away + refresh dashboards. */
		ondeleted?: () => void;
		/** Awaited page refresh after a successful revert-to-draft (issue #150). */
		onreverted?: () => Promise<void>;
		/** Opens the append import wizard from settings while keeping manager-only visibility. */
		onimport: () => void;
		/** Downloads the gift spreadsheet export from settings while keeping manager-only visibility. */
		onexport: () => void;
		/** Opens the shared edit-recipient dialog (issue #150) — the page renders it. */
		oneditrecipient?: () => void;
	}

	/** Normalize a stored event date to a `Date` for the `DatePicker`, or `null` when unset/invalid. */
	function toEventDate(value: Date | string | null): Date | null {
		if (value === null) {
			return null;
		}
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	let {
		open = $bindable(false),
		activeTab = $bindable(WISHLIST_SETTINGS_TABS.details),
		wishlist,
		canManage,
		role,
		revertCapability,
		recipientDisplayName,
		themeEmoji,
		onsaved,
		onpaletteselect,
		ondeleted,
		onreverted,
		onimport,
		onexport,
		oneditrecipient,
	}: WishlistSettingsModalProps = $props();

	const isArchived = $derived(wishlist.status === 'archived');
	const isShared = $derived(wishlist.sharedAt !== null);
	// An app admin who does not manage this list still reaches the danger zone for the revert
	// action only (issue #150). Non-hidden capability for a non-manager ⟺ admin on a reserved list.
	const isAdminRevertOnly = $derived(!canManage && revertCapability !== REVERT_CAPABILITY.hidden);
	// Recipient edit affordance (issue #150): free-text lists → the recipient name is an inline
	// field any manager edits and saves with the details form; linked lists → the name is read-only,
	// and ONLY the linked recipient may flip to a free-text recipient (no evicting by správci) via
	// the shared dialog.
	const isFreeTextRecipient = $derived(wishlist.recipientUserId === null);
	const canFlipRecipient = $derived(role === WISHLIST_ROLES.recipient);

	// Event-date grace window (issue #83): after sharing, the event date stays editable for a
	// debounced 2-min window before it locks. `eventDateEditedAt` drives the debounce, falling back
	// to `sharedAt` until the first in-window edit. The countdown re-locks the field live at zero.
	let eventDateClockNow = $state(new Date());
	const eventDateGraceExpiresAt = $derived(
		isShared ? graceWindowExpiresAt(wishlist.eventDateEditedAt ?? wishlist.sharedAt) : null,
	);
	const eventDateEditable = $derived(
		!isShared ||
			(eventDateGraceExpiresAt !== null &&
				eventDateClockNow.getTime() < eventDateGraceExpiresAt.getTime()),
	);
	$effect(() => {
		if (!open || eventDateGraceExpiresAt === null) {
			return;
		}
		const expiry = eventDateGraceExpiresAt.getTime();
		eventDateClockNow = new Date();
		const id = setInterval(() => {
			eventDateClockNow = new Date();
			if (eventDateClockNow.getTime() >= expiry) {
				clearInterval(id); // window closed – the field has already re-locked
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// One-time seed; handleOpenChange re-seeds on close so the next open starts fresh.
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsTitle = $state(wishlist.title);
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsDescription = $state(wishlist.description ?? '');
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let detailsEventDate = $state(toEventDate(wishlist.eventDate));
	// Free-text recipient name (issue #150): an inline field saved alongside the details form.
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state)
	let recipientNameDraft = $state(recipientDisplayName);
	let detailsError = $state('');
	let savingDetails = $state(false);
	let savingImage = $state(false);
	let categoriesDirty = $state(false);
	let savingCategories = $state(false);

	/** Re-seed the details form from the canonical server values (server trims/normalizes). */
	function seedDetailsForm() {
		detailsTitle = wishlist.title;
		detailsDescription = wishlist.description ?? '';
		detailsEventDate = toEventDate(wishlist.eventDate);
		recipientNameDraft = recipientDisplayName;
		detailsError = '';
	}

	function approveCategoryDiscard(): boolean {
		if (categoriesDirty && !window.confirm(m.gift_categories_unsaved_confirm())) {
			return false;
		}
		categoriesDirty = false;
		return true;
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen && !approveCategoryDiscard()) {
			open = true;
			return;
		}
		if (!nextOpen) {
			// Discard unsaved edits on close; the next open re-seeds from the current wishlist.
			seedDetailsForm();
		}
	}

	function handleImport() {
		if (!approveCategoryDiscard()) {
			return;
		}
		onimport();
	}

	async function handleDetailsSave(event: SubmitEvent) {
		event.preventDefault();

		const trimmedTitle = detailsTitle.trim();
		if (trimmedTitle === '') {
			detailsError = m.wishlist_name_required();
			return;
		}

		detailsError = '';
		savingDetails = true;
		try {
			const trimmedDescription = detailsDescription.trim();
			await updateWishlist({
				id: wishlist.id,
				title: trimmedTitle,
				description: trimmedDescription === '' ? null : trimmedDescription,
				// Event date stays editable within the post-share grace window; the server is the
				// authority and drops it once the window has closed (issue #83).
				...(eventDateEditable ? { eventDate: detailsEventDate } : {}),
			});
			// Free-text recipient rename rides the same Save (issue #150): reuses the renameRecipient
			// command (rejects linked lists server-side). Only persist an actual change to skip a
			// redundant call; a failure surfaces via the shared catch/toast below.
			const trimmedRecipientName = recipientNameDraft.trim();
			if (
				isFreeTextRecipient &&
				trimmedRecipientName !== '' &&
				trimmedRecipientName !== recipientDisplayName
			) {
				await renameRecipient({ id: wishlist.id, recipientName: trimmedRecipientName });
			}
			await onsaved();
			seedDetailsForm();
			toastSuccess(m.toast_wishlist_details_saved());
		} catch (thrown) {
			console.error('Failed to save wishlist details:', thrown);
			toastError(m.toast_wishlist_details_save_error());
		} finally {
			savingDetails = false;
		}
	}

	async function handleImageSave(next: {
		imageKey: string | null;
		imageSlots: WishlistImageSlots | null;
	}) {
		savingImage = true;
		try {
			await updateWishlist({
				id: wishlist.id,
				imageKey: next.imageKey,
				imageSlots: next.imageSlots,
			});
			await onsaved();
			toastSuccess(m.toast_wishlist_image_saved());
		} catch (thrown) {
			console.error('Failed to save wishlist image:', thrown);
			toastError(m.toast_wishlist_image_save_error());
		} finally {
			savingImage = false;
		}
	}

	// ── Delete handler (issue #120) ────────────────────────────────────────────
	// Delete is only possible for an unshared (draft) wishlist – the same rule the
	// `deleteWishlist` command enforces server-side; a shared list must be archived instead.

	let deleteConfirmOpen = $state(false);
	let deleting = $state(false);

	async function handleDeleteConfirmed() {
		deleting = true;
		try {
			await deleteWishlist(wishlist.id);
			deleteConfirmOpen = false;
			open = false;
			toastSuccess(m.toast_wishlist_deleted());
			ondeleted?.();
		} catch (thrown) {
			console.error('Failed to delete wishlist:', thrown);
			toastError(translateServerError(thrown, m.toast_wishlist_delete_error()));
		} finally {
			deleting = false;
		}
	}

	// ── Revert-to-draft handler (issue #150) ───────────────────────────────────
	// A shared list can return to draft: a správce silently when reservation-free, an app admin
	// when reserved (cancels reservations + notifies). The reserved variant confirm dialog spells
	// out the cancellation; the server re-checks the capability as the security boundary.

	let revertConfirmOpen = $state(false);
	let reverting = $state(false);

	async function handleRevertConfirmed() {
		reverting = true;
		try {
			await revertWishlistToDraft(wishlist.id);
			revertConfirmOpen = false;
			open = false;
			toastSuccess(m.toast_wishlist_reverted());
			await onreverted?.();
		} catch (thrown) {
			console.error('Failed to revert wishlist:', thrown);
			toastError(translateServerError(thrown, m.toast_wishlist_revert_error()));
		} finally {
			reverting = false;
		}
	}
</script>

<!-- Revert-to-draft card (issue #150). Rendered per the server-computed capability: enabled for a
     clean/reserved-admin revert, DISABLED with the „jen administrátor" copy for a non-admin správce
     on a reserved list, and nothing at all when hidden. Reused by the manager danger panel and the
     admin-only view. -->
{#snippet revertSection()}
	{#if revertCapability !== REVERT_CAPABILITY.hidden}
		<Card.Root class="border-destructive/30">
			<Card.Header>
				<div class="flex items-center gap-2">
					<RotateCcwIcon class="size-5 text-destructive" />
					<div>
						<Card.Title class="text-destructive">
							{m.wishlist_settings_revert_title()}
						</Card.Title>
						<Card.Description>{m.wishlist_settings_revert_hint()}</Card.Description>
					</div>
				</div>
			</Card.Header>
			<Card.Content>
				{#if revertCapability === REVERT_CAPABILITY.reservedBlocked}
					<div class="flex flex-col gap-3">
						<Alert.Root tone="warning">
							<Alert.Description>
								{m.wishlist_revert_reserved_admin_only()}
							</Alert.Description>
						</Alert.Root>
						<div class="flex justify-end">
							<Button intent="danger" size="sm" disabled>
								<RotateCcwIcon data-icon="inline-start" />
								{m.wishlist_revert_button()}
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#if revertCapability === REVERT_CAPABILITY.reservedAdmin}
							<p class="text-xs text-muted-foreground">
								{m.wishlist_revert_reserved_warning()}
							</p>
						{/if}
						<div class="flex justify-end">
							<Button
								intent="danger"
								size="sm"
								data-testid="settings-revert-to-draft"
								onclick={() => (revertConfirmOpen = true)}
							>
								<RotateCcwIcon data-icon="inline-start" />
								{m.wishlist_revert_button()}
							</Button>
						</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
{/snippet}

<!-- Per-wishlist settings modal (UX rework of the old /w/<id>/settings page). Panels hide via
     the `hidden` attribute instead of unmounting so unsaved edits (typed details,
     uploaded-but-unsaved image) survive tab switches; closing the dialog unmounts everything,
     matching the old leave-the-page reset. -->
<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content size="2xl" class="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0">
		<Dialog.Header class="shrink-0 px-6 pt-6 pb-4">
			<Dialog.Title>{m.wishlist_settings_title()}</Dialog.Title>
			<Dialog.Description>{wishlist.title}</Dialog.Description>
		</Dialog.Header>

		<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
			{#if canManage && !isArchived}
				<Tabs.Root
					aria-label={m.wishlist_settings_title()}
					class="w-full max-w-full justify-self-stretch overflow-x-auto [&>[role=tab]]:shrink-0 [&>[role=tab]]:whitespace-nowrap sm:w-auto sm:justify-self-start"
				>
					<Tabs.Tab
						id="wishlist-settings-tab-details"
						aria-controls="wishlist-settings-panel-details"
						active={activeTab === WISHLIST_SETTINGS_TABS.details}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.details)}
					>
						{m.wishlist_settings_details_section()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-data"
						aria-controls="wishlist-settings-panel-data"
						active={activeTab === WISHLIST_SETTINGS_TABS.data}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.data)}
					>
						{m.wishlist_settings_data_title()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-categories"
						aria-controls="wishlist-settings-panel-categories"
						active={activeTab === WISHLIST_SETTINGS_TABS.categories}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.categories)}
					>
						{m.wishlist_settings_categories_tab()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-appearance"
						aria-controls="wishlist-settings-panel-appearance"
						active={activeTab === WISHLIST_SETTINGS_TABS.appearance}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.appearance)}
					>
						{m.wishlist_settings_appearance_tab()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-image"
						aria-controls="wishlist-settings-panel-image"
						active={activeTab === WISHLIST_SETTINGS_TABS.image}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.image)}
					>
						{m.wishlist_settings_image_section()}
					</Tabs.Tab>
					<Tabs.Tab
						id="wishlist-settings-tab-danger"
						aria-controls="wishlist-settings-panel-danger"
						active={activeTab === WISHLIST_SETTINGS_TABS.danger}
						onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.danger)}
					>
						{m.wishlist_settings_danger_tab()}
					</Tabs.Tab>
				</Tabs.Root>

				<!-- Podrobnosti: title / description / event date, saved via updateWishlist -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-details"
					aria-labelledby="wishlist-settings-tab-details"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.details}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_details_hint()}
						</p>

						<form
							id="wishlist-details-form"
							onsubmit={handleDetailsSave}
							class="flex flex-col gap-4"
						>
							<!-- Recipient (issue #150): free-text lists get an inline name field saved with
						     this form; linked lists show a read-only name, and only the linked recipient
						     may flip to a free-text recipient (no evicting by správci) via the dialog. -->
							{#if isFreeTextRecipient}
								<div class="flex flex-col gap-2">
									<Label for="wishlist-settings-recipient"
										>{m.recipient_section_title()}</Label
									>
									<Input
										id="wishlist-settings-recipient"
										bind:value={recipientNameDraft}
										placeholder={m.create_recipient_name_placeholder()}
										maxlength={RECIPIENT_NAME_MAX_LENGTH}
										disabled={savingDetails}
									/>
									<RecipientPreview name={recipientNameDraft} />
								</div>
							{:else}
								<div
									class="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2"
								>
									<div class="min-w-0">
										<p class="text-sm font-medium">
											{m.recipient_section_title()}
										</p>
										<p class="truncate text-sm text-muted-foreground">
											{recipientDisplayName}
										</p>
									</div>
									{#if canFlipRecipient}
										<Button
											type="button"
											size="sm"
											intent="outline"
											data-testid="settings-edit-recipient"
											onclick={oneditrecipient}
										>
											<PencilIcon data-icon="inline-start" />
											{m.wishlist_edit_recipient_label()}
										</Button>
									{/if}
								</div>
							{/if}

							<Field
								fieldId="wishlist-title"
								label={m.wishlist_name_label()}
								errorMessage={detailsError}
							>
								{#snippet children({ hasError, errorId }: FieldControlContext)}
									<Input
										id="wishlist-title"
										bind:value={detailsTitle}
										placeholder={m.wishlist_name_placeholder()}
										required
										maxlength={WISHLIST_TITLE_MAX_LENGTH}
										disabled={savingDetails}
										state={hasError ? 'error' : 'default'}
										aria-invalid={hasError ? true : undefined}
										aria-describedby={errorId}
									/>
								{/snippet}
							</Field>

							<div class="flex flex-col gap-2">
								<Label for="wishlist-description"
									>{m.wishlist_description_label()}</Label
								>
								<Textarea
									id="wishlist-description"
									bind:value={detailsDescription}
									placeholder={m.wishlist_description_placeholder()}
									disabled={savingDetails}
								/>
							</div>

							<div class="flex flex-col gap-2">
								<Label id="wishlist-event-date-label"
									>{m.wishlist_event_date_label()}</Label
								>
								<DatePicker
									id="wishlist-event-date"
									ariaLabelledby="wishlist-event-date-label"
									bind:value={detailsEventDate}
									disabled={savingDetails || !eventDateEditable}
								/>
								{#if isShared && eventDateEditable && eventDateGraceExpiresAt !== null}
									<GraceCountdown
										expiresAt={eventDateGraceExpiresAt}
										now={eventDateClockNow}
										message={m.wishlist_event_date_grace_hint}
									/>
								{:else if isShared}
									<HelpText>{m.wishlist_event_date_locked_hint()}</HelpText>
								{/if}
							</div>
						</form>
					</div>
				</div>

				<!-- Import/export: uses the existing actions without duplicate card chrome or heading. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-data"
					aria-labelledby="wishlist-settings-tab-data"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.data}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_data_hint()}
						</p>
						<div class="flex flex-wrap gap-2">
							<Button type="button" intent="outline" size="sm" onclick={handleImport}>
								<FileUpIcon data-icon="inline-start" />
								{m.import_toolbar_label()}
							</Button>
							<Button type="button" intent="outline" size="sm" onclick={onexport}>
								<FileDownIcon data-icon="inline-start" />
								{m.export_toolbar_label()}
							</Button>
						</div>
					</div>
				</div>

				<!-- Kategorie: managed wishlist gift categories. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-categories"
					aria-labelledby="wishlist-settings-tab-categories"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.categories}
				>
					<WishlistCategorySettings
						wishlistId={wishlist.id}
						ondirtychange={(dirty) => (categoriesDirty = dirty)}
						onsavingchange={(saving) => (savingCategories = saving)}
					/>
				</div>

				<!-- Vzhled: palette picker, auto-saves on click. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-appearance"
					aria-labelledby="wishlist-settings-tab-appearance"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.appearance}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_palette_dialog_description()}
						</p>
						<WishlistPaletteAutoSave
							wishlistId={wishlist.id}
							palette={wishlist.palette}
							onselect={onpaletteselect}
						/>
					</div>
				</div>

				<!-- Obrázek a ořezy: the crop editor keeps its own save button -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-image"
					aria-labelledby="wishlist-settings-tab-image"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.image}
				>
					<div class="flex flex-col gap-4">
						<p class="text-sm text-muted-foreground">
							{m.wishlist_settings_image_hint()}
						</p>
						<WishlistCropEditor
							formId="wishlist-image-form"
							imageKey={wishlist.imageKey}
							imageSlots={wishlist.imageSlots}
							{themeEmoji}
							title={wishlist.title}
							isSaving={savingImage}
							onsave={handleImageSave}
						/>
					</div>
				</div>

				<!-- Nebezpečná zóna: delete is only offered for an unshared list (issue #120), a
			     shared list must be archived instead, matching the deleteWishlist server guard. -->
				<div
					role="tabpanel"
					id="wishlist-settings-panel-danger"
					aria-labelledby="wishlist-settings-tab-danger"
					hidden={activeTab !== WISHLIST_SETTINGS_TABS.danger}
				>
					<div class="flex flex-col gap-4">
						<!-- Revert to draft (issue #150): shown for a shared list per the server-computed
					     capability; sits above delete. Delete stays draft-only (issue #120). -->
						{@render revertSection()}
						{#if isShared}
							<Alert.Root tone="warning">
								<Alert.Description
									>{m.wishlist_settings_danger_shared_notice()}</Alert.Description
								>
							</Alert.Root>
						{:else}
							<Card.Root class="border-destructive/30">
								<Card.Header>
									<div class="flex items-center gap-2">
										<TriangleAlertIcon class="size-5 text-destructive" />
										<div>
											<Card.Title class="text-destructive">
												{m.wishlist_settings_danger_tab()}
											</Card.Title>
											<Card.Description
												>{m.wishlist_settings_danger_hint()}</Card.Description
											>
										</div>
									</div>
								</Card.Header>
								<Card.Content>
									<div class="flex items-center justify-between gap-4">
										<div>
											<p class="text-sm font-medium">
												{m.wishlist_delete_button()}
											</p>
											<p class="text-xs text-muted-foreground">
												{m.wishlist_delete_confirm_description()}
											</p>
										</div>
										<Button
											intent="danger"
											size="sm"
											onclick={() => (deleteConfirmOpen = true)}
										>
											<TrashIcon data-icon="inline-start" />
											{m.wishlist_delete_button()}
										</Button>
									</div>
								</Card.Content>
							</Card.Root>
						{/if}
					</div>
				</div>
			{:else if isAdminRevertOnly}
				<!-- App admin who does not manage this list: danger/admin actions only (revert). -->
				<div class="flex flex-col gap-4">
					<p class="text-sm text-muted-foreground">
						{m.wishlist_settings_admin_only_hint()}
					</p>
					{@render revertSection()}
				</div>
			{:else if isArchived}
				<Alert.Root tone="warning">
					<Alert.Description>{m.wishlist_settings_archived_readonly()}</Alert.Description>
				</Alert.Root>
			{:else}
				<Alert.Root tone="warning">
					<Alert.Description>{m.wishlist_settings_owner_only()}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		{#if canManage && !isArchived && activeTab === WISHLIST_SETTINGS_TABS.details}
			<Dialog.Footer class="shrink-0 border-t border-border bg-background px-6 py-4">
				<Button type="submit" form="wishlist-details-form" disabled={savingDetails}>
					{#if savingDetails}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
					{/if}
					{m.save()}
				</Button>
			</Dialog.Footer>
		{:else if canManage && !isArchived && activeTab === WISHLIST_SETTINGS_TABS.categories}
			<Dialog.Footer class="shrink-0 border-t border-border bg-background px-6 py-4">
				<Button
					type="submit"
					form="wishlist-categories-form"
					disabled={savingCategories || !categoriesDirty}
				>
					{savingCategories ? m.saving() : m.save()}
				</Button>
			</Dialog.Footer>
		{:else if canManage && !isArchived && activeTab === WISHLIST_SETTINGS_TABS.image}
			<Dialog.Footer class="shrink-0 border-t border-border bg-background px-6 py-4">
				<Button
					type="submit"
					form="wishlist-image-form"
					data-testid="wishlist-image-save"
					disabled={savingImage}
				>
					{savingImage ? m.saving() : m.save()}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Delete confirmation dialog (issue #120) -->
<Dialog.Root bind:open={deleteConfirmOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_delete_confirm_title({ title: wishlist.title })}</Dialog.Title
			>
			<Dialog.Description>{m.wishlist_delete_confirm_description()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button
				intent="outline"
				onclick={() => (deleteConfirmOpen = false)}
				disabled={deleting}
			>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleDeleteConfirmed} disabled={deleting}>
				{deleting ? m.deleting() : m.wishlist_delete_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Revert-to-draft confirmation dialog (issue #150): the reserved variant spells out that all
     reservations are cancelled and reservers notified; the clean variant is silent. -->
<Dialog.Root bind:open={revertConfirmOpen}>
	<Dialog.Content size="md">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_revert_confirm_title()}</Dialog.Title>
			<Dialog.Description>
				{revertCapability === REVERT_CAPABILITY.reservedAdmin
					? m.wishlist_revert_confirm_reserved_description()
					: m.wishlist_revert_confirm_clean_description()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="flex gap-2">
			<Button
				intent="outline"
				onclick={() => (revertConfirmOpen = false)}
				disabled={reverting}
			>
				{m.cancel()}
			</Button>
			<Button intent="danger" onclick={handleRevertConfirmed} disabled={reverting}>
				{reverting ? m.wishlist_reverting() : m.wishlist_revert_confirm_action()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
