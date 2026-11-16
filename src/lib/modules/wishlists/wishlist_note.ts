import { browser } from '$app/environment';
import { Persisted, jsonSerde } from '$lib/reactivity/persisted.svelte';
import { StateRaw, type MutableState } from '$lib/reactivity/state.svelte';
import { appHydrated } from '$lib/utils/app_hydration.js';

export const WISHLIST_NOTE_STATES = {
	open: 'open',
	folded: 'folded',
	dismissed: 'dismissed',
} as const;

export type WishlistNoteState = (typeof WISHLIST_NOTE_STATES)[keyof typeof WISHLIST_NOTE_STATES];

const WISHLIST_NOTE_STATE_VALUES: readonly string[] = Object.values(WISHLIST_NOTE_STATES);

function isWishlistNoteState(value: unknown): value is WishlistNoteState {
	return typeof value === 'string' && WISHLIST_NOTE_STATE_VALUES.includes(value);
}

/** The note a wishlist description makes: its trimmed text, or null when there is none. */
export function wishlistNoteText(description: string | null | undefined): string | null {
	const text = description?.trim() ?? '';
	return text === '' ? null : text;
}

/**
 * How one wishlist's note shows in this browser. The server render and hydration use the
 * first-visit default (open); the stored state applies once a note has mounted, so the hydrated
 * markup always matches the server's.
 */
class WishlistNoteVisibility implements MutableState<WishlistNoteState> {
	#stored: MutableState<WishlistNoteState>;
	#hydrated = new StateRaw(appHydrated());

	constructor(stored: MutableState<WishlistNoteState>) {
		this.#stored = stored;
	}

	get current(): WishlistNoteState {
		return this.#hydrated.current ? this.#stored.current : WISHLIST_NOTE_STATES.open;
	}

	set current(state: WishlistNoteState) {
		this.#stored.current = state;
	}

	markHydrated(): void {
		this.#hydrated.current = true;
	}
}

/**
 * A new, unshared visibility: remembered per wishlist id, or kept only as long as its caller
 * without one (landing demo).
 */
export function createWishlistNoteVisibility(wishlistId: string | null): WishlistNoteVisibility {
	if (wishlistId === null) {
		return new WishlistNoteVisibility(
			new StateRaw<WishlistNoteState>(WISHLIST_NOTE_STATES.open),
		);
	}
	return new WishlistNoteVisibility(
		new Persisted<WishlistNoteState>({
			key: `prejemesi-wishlist:${wishlistId}:note`,
			serde: jsonSerde(isWishlistNoteState),
			defaultValue: WISHLIST_NOTE_STATES.open,
		}),
	);
}

// Shared on purpose so the toolbar's restore action reaches the header note; browser-only because
// server renders must not share state across requests.
const visibilityByWishlistId = new Map<string, WishlistNoteVisibility>();

/** The one visibility this browser keeps for a wishlist's note. */
export function wishlistNoteVisibility(wishlistId: string): WishlistNoteVisibility {
	if (!browser) {
		return createWishlistNoteVisibility(wishlistId);
	}
	let visibility = visibilityByWishlistId.get(wishlistId);
	if (visibility === undefined) {
		visibility = createWishlistNoteVisibility(wishlistId);
		visibilityByWishlistId.set(wishlistId, visibility);
	}
	return visibility;
}

/**
 * Who the note is from. Nobody records the description's author, so a linked recipient's own
 * list speaks for them; a list for someone else is written by its správci, named only when there
 * is exactly one. Null means the neutral „Vzkaz k seznamu" label.
 */
export function wishlistNoteAuthorName({
	isForSomeoneElse,
	recipientDisplayName,
	managerNames,
}: {
	isForSomeoneElse: boolean;
	recipientDisplayName: string;
	managerNames: readonly string[];
}): string | null {
	const authorName = isForSomeoneElse
		? managerNames.length === 1
			? managerNames[0]!
			: ''
		: recipientDisplayName;
	return authorName.trim() === '' ? null : authorName;
}
