<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { ALERT_TONE_ROLES } from '$lib/components/base/alert/alert_variants.js';
	import { Button } from '$lib/components/base/button/index.js';
	import MessageSquareQuoteIcon from '@lucide/svelte/icons/message-square-quote';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		WISHLIST_NOTE_STATES,
		createWishlistNoteVisibility,
		wishlistNoteVisibility,
		type WishlistNoteState,
	} from '$lib/modules/wishlists/wishlist_note.js';
	import { wishlistNoteVariants } from './wishlist_note_variants.js';

	interface WishlistNoteProps {
		description: string;
		/** Null shows the neutral „Vzkaz k seznamu" label (see `wishlistNoteAuthorName`). */
		authorName: string | null;
		/** Scopes the remembered fold/dismiss state; null keeps it for this mount only. */
		wishlistId?: string | null;
		/** Settings preview: always open, without controls or remembered state. */
		preview?: boolean;
		/** Called once the reader confirms hiding the note, so the page can move focus. */
		ondismiss?: () => void;
		/** Page-entry reveal classes; a note restored after the page rendered appears without them. */
		entranceClass?: string;
	}

	const CONFIRM_DISMISS = 'confirm-dismiss';

	let {
		description,
		authorName,
		wishlistId = null,
		preview = false,
		ondismiss,
		entranceClass,
	}: WishlistNoteProps = $props();

	const styles = wishlistNoteVariants();

	const unsharedVisibility = createWishlistNoteVisibility(null);
	const visibility = $derived(
		wishlistId === null ? unsharedVisibility : wishlistNoteVisibility(wishlistId),
	);
	let confirmingDismiss = $state(false);
	let mounted = $state(false);
	let foldButton = $state<HTMLElement | null>(null);
	let unfoldButton = $state<HTMLElement | null>(null);
	let dismissButton = $state<HTMLElement | null>(null);
	let confirmTitle = $state<HTMLElement | null>(null);

	const label = $derived(
		authorName === null
			? m.wishlist_note_untitled()
			: m.wishlist_note_author({ name: authorName }),
	);
	const noteState = $derived<WishlistNoteState>(
		preview ? WISHLIST_NOTE_STATES.open : visibility.current,
	);
	const displayedState = $derived(confirmingDismiss ? CONFIRM_DISMISS : noteState);
	// The confirmation appears in response to the reader's action, so it is announced.
	const alertRole = $derived(
		displayedState === CONFIRM_DISMISS ? 'alert' : ALERT_TONE_ROLES.palette,
	);

	async function changeNoteState(
		nextState: WishlistNoteState,
		getFocusTarget: () => HTMLElement | null,
	) {
		visibility.current = nextState;
		await tick();
		getFocusTarget()?.focus();
	}

	async function startDismiss() {
		confirmingDismiss = true;
		await tick();
		confirmTitle?.focus();
	}

	async function cancelDismiss() {
		confirmingDismiss = false;
		await tick();
		dismissButton?.focus();
	}

	function confirmDismiss() {
		confirmingDismiss = false;
		visibility.current = WISHLIST_NOTE_STATES.dismissed;
		ondismiss?.();
	}

	// Untracked, so the note rendered with the page keeps its reveal running after mount.
	function wrapperEntranceClass() {
		return untrack(() => mounted) ? undefined : entranceClass;
	}

	function handleConfirmKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			void cancelDismiss();
		}
	}

	onMount(() => {
		mounted = true;
		if (!preview) {
			visibility.markHydrated();
		}
	});
</script>

{#snippet dismissControl()}
	<Button
		bind:ref={dismissButton}
		format="icon"
		intent="ghost"
		aria-label={m.wishlist_note_dismiss()}
		onclick={startDismiss}
	>
		<XIcon />
	</Button>
{/snippet}

{#if displayedState !== WISHLIST_NOTE_STATES.dismissed}
	<div class={wrapperEntranceClass()} data-testid="wishlist-note">
		<!-- A freshly inserted role="alert" is announced reliably; switching the role in place is not. -->
		{#key confirmingDismiss}
			<Alert.Root
				tone="palette"
				role={alertRole}
				onkeydown={displayedState === CONFIRM_DISMISS ? handleConfirmKeydown : undefined}
			>
				{#if displayedState === WISHLIST_NOTE_STATES.open}
					<MessageSquareQuoteIcon aria-hidden="true" />
					<div class={styles.headerRow()}>
						<Alert.Title class={styles.label()}>{label}</Alert.Title>
						{#if !preview}
							<div class={styles.controls()}>
								<Button
									bind:ref={foldButton}
									format="icon"
									intent="ghost"
									aria-label={m.wishlist_note_fold()}
									onclick={() =>
										changeNoteState(
											WISHLIST_NOTE_STATES.folded,
											() => unfoldButton,
										)}
								>
									<ChevronUpIcon />
								</Button>
								{@render dismissControl()}
							</div>
						{/if}
					</div>
					<Alert.Description class={styles.body()}>{description}</Alert.Description>
				{:else if displayedState === WISHLIST_NOTE_STATES.folded}
					<MessageSquareQuoteIcon aria-hidden="true" />
					<div class={styles.headerRow()}>
						<p class={styles.foldedText()}>
							<span class={styles.foldedLabel()}>{label}:</span>
							{description}
						</p>
						<div class={styles.controls()}>
							<Button
								bind:ref={unfoldButton}
								intent="link"
								onclick={() =>
									changeNoteState(WISHLIST_NOTE_STATES.open, () => foldButton)}
							>
								{m.wishlist_note_unfold()}
								<ChevronDownIcon data-icon="inline-end" />
							</Button>
							{@render dismissControl()}
						</div>
					</div>
				{:else}
					<EyeOffIcon aria-hidden="true" />
					<Alert.Title
						bind:ref={confirmTitle}
						tabindex={-1}
						class={styles.confirmTitle()}
					>
						{m.wishlist_note_dismiss_title()}
					</Alert.Title>
					<Alert.Description>{m.wishlist_note_dismiss_description()}</Alert.Description>
					<Alert.Action placement="below" class={styles.confirmActions()}>
						<Button intent="outline" onclick={cancelDismiss}>
							{m.wishlist_note_keep()}
						</Button>
						<Button intent="primary" onclick={confirmDismiss}>
							{m.wishlist_note_dismiss_confirm()}
						</Button>
					</Alert.Action>
				{/if}
			</Alert.Root>
		{/key}
	</div>
{/if}
