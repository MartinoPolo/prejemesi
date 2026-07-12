<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { DatePicker } from '$lib/components/derived/date-picker/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { WishlistCropEditor } from '$lib/components/blocks/wishlist/index.js';
	import {
		getWishlistByShortId,
		updateWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { canManageWishlist } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import { graceWindowExpiresAt } from '$lib/modules/sharing/grace_window.js';
	import GraceCountdown from '$lib/components/derived/grace-countdown/GraceCountdown.svelte';
	import { getWishlistEmoji } from '$lib/modules/wishlists/wishlist_theme.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';

	/** Normalize a stored event date to a `Date` for the `DatePicker`, or `null` when unset/invalid. */
	function toEventDate(value: Date | string | null): Date | null {
		if (value === null) {
			return null;
		}
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	const shortId = $derived(page.params.id!);

	// The reactive query is tracked, so updateWishlist's server-side single-flight
	// refresh rides back on the save response and updates `wishlist` with no
	// follow-up fetch (issue #108). The awaited value seeds SSR and the form.
	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state thereafter)
	const initial = await getWishlistByShortId(shortId);
	const wishlistQuery = $derived(getWishlistByShortId(shortId));
	const wishlist = $derived(wishlistQuery.current ?? initial);

	// Settings editing is manager-gated (recipient OR správce); non-managers see a read-only alert.
	const canManage = $derived(canManageWishlist(wishlist.role));
	const isArchived = $derived(wishlist.status === 'archived');
	const isShared = $derived(wishlist.sharedAt !== null);
	const themeEmoji = $derived(getWishlistEmoji(wishlist.theme));

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
		if (eventDateGraceExpiresAt === null) {
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

	let detailsTitle = $state(initial.title);
	let detailsDescription = $state(initial.description ?? '');
	let detailsEventDate = $state(toEventDate(initial.eventDate));
	let detailsError = $state('');
	let savingDetails = $state(false);
	let savingImage = $state(false);

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
			// The command's single-flight refresh updates the tracked `wishlist` query
			// before this await resolves — no follow-up fetch needed.
			await updateWishlist({
				id: wishlist.id,
				title: trimmedTitle,
				description: trimmedDescription === '' ? null : trimmedDescription,
				// Event date stays editable within the post-share grace window; the server is the
				// authority and drops it once the window has closed (issue #83).
				...(eventDateEditable ? { eventDate: detailsEventDate } : {}),
			});
			// Re-seed the form from the canonical server values (server trims/normalizes).
			detailsTitle = wishlist.title;
			detailsDescription = wishlist.description ?? '';
			detailsEventDate = toEventDate(wishlist.eventDate);
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
			toastSuccess(m.toast_wishlist_image_saved());
		} catch (thrown) {
			console.error('Failed to save wishlist image:', thrown);
			toastError(m.toast_wishlist_image_save_error());
		} finally {
			savingImage = false;
		}
	}

	function goBack() {
		void goto(localizeInternalHref(resolve('/(app)/w/[id]', { id: shortId })));
	}

	// Deep link from the wishlist banner's hover "Edit image" button lands on #image.
	// The async load resolves before this component mounts, so the native hash scroll
	// misses the (not-yet-rendered) target – scroll it into view manually after render.
	onMount(async () => {
		if (page.url.hash !== '#image') {
			return;
		}
		await tick();
		document.getElementById('image')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});
</script>

<svelte:head>
	<title>{m.wishlist_settings_title()} – Přejeme si</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
	<div class="flex items-center gap-3">
		<Button
			intent="ghost"
			size="icon-sm"
			aria-label={m.wishlist_settings_back()}
			onclick={goBack}
		>
			<ArrowLeftIcon />
		</Button>
		<div class="flex flex-col">
			<h1 class="font-heading text-2xl font-bold">{m.wishlist_settings_title()}</h1>
			<p class="text-sm text-muted-foreground">{wishlist.title}</p>
		</div>
	</div>

	{#if !canManage}
		<Alert.Root tone="warning">
			<Alert.Description>{m.wishlist_settings_owner_only()}</Alert.Description>
		</Alert.Root>
	{:else if isArchived}
		<Alert.Root tone="warning">
			<Alert.Description>{m.wishlist_settings_archived_readonly()}</Alert.Description>
		</Alert.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.wishlist_settings_details_section()}</Card.Title>
				<Card.Description>{m.wishlist_settings_details_hint()}</Card.Description>
			</Card.Header>
			<Card.Content>
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
						<Label for="wishlist-description">{m.wishlist_description_label()}</Label>
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
			</Card.Content>
		</Card.Root>

		<Card.Root id="image" class="scroll-mt-6">
			<Card.Header>
				<Card.Title>{m.wishlist_settings_image_section()}</Card.Title>
				<Card.Description>{m.wishlist_settings_image_hint()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<WishlistCropEditor
					imageKey={wishlist.imageKey}
					imageSlots={wishlist.imageSlots}
					{themeEmoji}
					title={wishlist.title}
					isSaving={savingImage}
					onsave={handleImageSave}
				/>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
