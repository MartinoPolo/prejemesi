<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import * as Tabs from '$lib/components/base/tabs/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import WishlistCropEditor from './WishlistCropEditor.svelte';
	import WishlistPalettePicker from './WishlistPalettePicker.svelte';
	import {
		WISHLIST_SETTINGS_TABS,
		type WishlistSettingsTab,
	} from './wishlist_settings_modal_types.js';
	import { updateWishlist } from '$lib/modules/wishlists/wishlists.remote.js';
	import { graceWindowExpiresAt } from '$lib/modules/sharing/grace_window.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';

	interface WishlistSettingsModalProps {
		open: boolean;
		/** Tab shown while the dialog is open; bindable so entry points can deep-link a tab. */
		activeTab: WishlistSettingsTab;
		wishlist: Wishlist;
		/** Recipient OR správce; non-managers get a read-only notice instead of the forms. */
		canManage: boolean;
		/** Theme-derived fallback emoji for the crop editor previews. */
		themeEmoji: string;
		/** Awaited page refresh after a save so the form can re-seed from fresh values. */
		onsaved: () => Promise<void>;
		/** Optimistic palette update so the page's data-palette subtree re-themes instantly. */
		onpaletteselect?: (palette: Palette) => void;
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
		themeEmoji,
		onsaved,
		onpaletteselect,
	}: WishlistSettingsModalProps = $props();

	const isArchived = $derived(wishlist.status === 'archived');
	const isShared = $derived(wishlist.sharedAt !== null);

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
	let detailsError = $state('');
	let savingDetails = $state(false);
	let savingImage = $state(false);

	/** Re-seed the details form from the canonical server values (server trims/normalizes). */
	function seedDetailsForm() {
		detailsTitle = wishlist.title;
		detailsDescription = wishlist.description ?? '';
		detailsEventDate = toEventDate(wishlist.eventDate);
		detailsError = '';
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			// Discard unsaved edits on close; the next open re-seeds from the current wishlist.
			seedDetailsForm();
		}
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
</script>

<!-- Per-wishlist settings modal (UX rework of the old /w/<id>/settings page): Podrobnosti /
     Vzhled / Obrázek tabs. Panels hide via the `hidden` attribute instead of unmounting so
     unsaved edits (typed details, uploaded-but-unsaved image) survive tab switches; closing
     the dialog unmounts everything, matching the old leave-the-page reset. -->
<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_settings_title()}</Dialog.Title>
			<Dialog.Description>{wishlist.title}</Dialog.Description>
		</Dialog.Header>

		{#if !canManage}
			<Alert.Root tone="warning">
				<Alert.Description>{m.wishlist_settings_owner_only()}</Alert.Description>
			</Alert.Root>
		{:else if isArchived}
			<Alert.Root tone="warning">
				<Alert.Description>{m.wishlist_settings_archived_readonly()}</Alert.Description>
			</Alert.Root>
		{:else}
			<Tabs.Root aria-label={m.wishlist_settings_title()} class="justify-self-start">
				<Tabs.Tab
					id="wishlist-settings-tab-details"
					aria-controls="wishlist-settings-panel-details"
					active={activeTab === WISHLIST_SETTINGS_TABS.details}
					onclick={() => (activeTab = WISHLIST_SETTINGS_TABS.details)}
				>
					{m.wishlist_settings_details_section()}
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
					<form onsubmit={handleDetailsSave} class="flex flex-col gap-4">
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
							<Label for="wishlist-event-date">{m.wishlist_event_date_label()}</Label>
							<DatePicker
								id="wishlist-event-date"
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
								<p class="text-sm text-muted-foreground">
									{m.wishlist_event_date_locked_hint()}
								</p>
							{/if}
						</div>

						<div class="flex justify-end">
							<Button type="submit" disabled={savingDetails}>
								{#if savingDetails}
									<LoaderIcon class="animate-spin" data-icon="inline-start" />
								{/if}
								{m.save()}
							</Button>
						</div>
					</form>
				</div>
			</div>

			<!-- Vzhled: palette picker, auto-saves on click (same component as the toolbar quick dialog) -->
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
					<WishlistPalettePicker
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
					<p class="text-sm text-muted-foreground">{m.wishlist_settings_image_hint()}</p>
					<WishlistCropEditor
						imageKey={wishlist.imageKey}
						imageSlots={wishlist.imageSlots}
						{themeEmoji}
						title={wishlist.title}
						isSaving={savingImage}
						onsave={handleImageSave}
					/>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
