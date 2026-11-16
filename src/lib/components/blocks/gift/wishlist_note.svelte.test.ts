import '../../../../app.css';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { flushSync } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import {
	WISHLIST_NOTE_STATES,
	wishlistNoteAuthorName,
	wishlistNoteVisibility,
} from '$lib/modules/wishlists/wishlist_note.js';
import WishlistNote from './WishlistNote.svelte';

const description =
	'Budu mít 30! Cokoliv z tohoto seznamu mě potěší.\nProsím žádné sladkosti, letos se snažím jíst zdravěji.';

let wishlistSequence = 0;
let wishlistId = '';

function renderNote(
	overrides: Partial<{
		preview: boolean;
		authorName: string | null;
		ondismiss: () => void;
	}> = {},
) {
	return render(WishlistNote, { wishlistId, description, authorName: 'Martin', ...overrides });
}

function storedNoteState(): unknown {
	const raw = localStorage.getItem(`prejemesi-wishlist:${wishlistId}:note`);
	return raw === null ? null : JSON.parse(raw);
}

function storeNoteState(state: string): void {
	localStorage.setItem(`prejemesi-wishlist:${wishlistId}:note`, JSON.stringify(state));
}

beforeEach(() => {
	localStorage.clear();
	wishlistSequence += 1;
	wishlistId = `note-test-${wishlistSequence}`;
});

afterEach(async () => {
	localStorage.clear();
	await page.viewport(1280, 720);
});

describe('WishlistNote', () => {
	it('opens on the first visit with the author, the full text and both controls', async () => {
		const screen = await renderNote();
		await expect
			.element(screen.getByText(m.wishlist_note_author({ name: 'Martin' })))
			.toBeVisible();
		const body = screen.getByText(/Budu mít 30!/);
		await expect.element(body).toBeVisible();
		expect(body.element().textContent).toContain('\n');
		expect(getComputedStyle(body.element()).whiteSpace).toBe('pre-line');
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_dismiss() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('folds to one line and remembers it across remounts', async () => {
		await page.viewport(390, 720);
		let screen = await renderNote();
		await screen.getByRole('button', { name: m.wishlist_note_fold() }).click();

		const unfold = screen.getByRole('button', { name: m.wishlist_note_unfold() });
		await expect.element(unfold).toHaveFocus();
		expect(storedNoteState()).toBe(WISHLIST_NOTE_STATES.folded);
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.not.toBeInTheDocument();
		const foldedLine = screen.getByTestId('wishlist-note').element().querySelector('p')!;
		expect(foldedLine.textContent).toContain('Budu mít 30!');
		expect(foldedLine.getBoundingClientRect().height).toBeLessThan(
			parseFloat(getComputedStyle(foldedLine).lineHeight) * 1.5,
		);
		await screen.unmount();

		screen = await renderNote();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_unfold() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.wishlist_note_unfold() }).click();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.toHaveFocus();
		await screen.unmount();

		screen = await renderNote();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('asks before hiding: Ponechat keeps the note, Skrýt hides it for good', async () => {
		const ondismiss = vi.fn();
		let screen = await renderNote({ ondismiss });
		await screen.getByRole('button', { name: m.wishlist_note_dismiss() }).click();

		const confirmation = screen.getByRole('alert');
		const question = confirmation.getByText(m.wishlist_note_dismiss_title());
		await expect.element(question).toHaveFocus();
		await expect
			.element(confirmation.getByText(m.wishlist_note_dismiss_description()))
			.toBeVisible();
		// Outline „Ponechat" first, the solid „Skrýt" last.
		const actions = confirmation.getByRole('button').elements();
		expect(actions.map((action) => action.textContent?.trim())).toEqual([
			m.wishlist_note_keep(),
			m.wishlist_note_dismiss_confirm(),
		]);
		await screen.getByRole('button', { name: m.wishlist_note_keep() }).click();
		expect(ondismiss).not.toHaveBeenCalled();

		await expect.element(screen.getByText(/Budu mít 30!/)).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_dismiss() }))
			.toHaveFocus();
		await screen.unmount();

		screen = await renderNote({ ondismiss });
		await expect.element(screen.getByText(/Budu mít 30!/)).toBeVisible();
		await screen.getByRole('button', { name: m.wishlist_note_dismiss() }).click();
		await screen
			.getByRole('button', { name: m.wishlist_note_dismiss_confirm(), exact: true })
			.click();
		await expect.element(screen.getByTestId('wishlist-note')).not.toBeInTheDocument();
		expect(storedNoteState()).toBe(WISHLIST_NOTE_STATES.dismissed);
		// The page moves focus to the restore action; the note only reports the dismissal.
		expect(ondismiss).toHaveBeenCalledOnce();
		await screen.unmount();

		screen = await renderNote();
		await expect.element(screen.getByTestId('wishlist-note')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('shows a note stored as folded folded on the first mount', async () => {
		storeNoteState(WISHLIST_NOTE_STATES.folded);
		const screen = await renderNote();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_unfold() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.not.toBeInTheDocument();
		await screen.unmount();
	});

	it('keeps a note stored as dismissed hidden on the first mount', async () => {
		storeNoteState(WISHLIST_NOTE_STATES.dismissed);
		const screen = await renderNote();
		await expect.element(screen.getByTestId('wishlist-note')).not.toBeInTheDocument();
		await screen.unmount();
	});

	it('keeps the author for screen readers on the narrow folded line', async () => {
		await page.viewport(320, 720);
		storeNoteState(WISHLIST_NOTE_STATES.folded);
		const screen = await renderNote();
		const unfold = screen.getByRole('button', { name: m.wishlist_note_unfold() });
		await expect.element(unfold).toBeVisible();
		const foldedLine = screen.getByTestId('wishlist-note').element().querySelector('p')!;
		expect(foldedLine.textContent).toContain(m.wishlist_note_author({ name: 'Martin' }));
		expect(foldedLine.getBoundingClientRect().height).toBeLessThan(
			parseFloat(getComputedStyle(foldedLine).lineHeight) * 1.5,
		);
		// The mobile-size controls still leave the row one text line tall, centred on that line.
		expect(foldedLine.parentElement!.getBoundingClientRect().height).toBeLessThanOrEqual(
			parseFloat(getComputedStyle(foldedLine).lineHeight) + 0.5,
		);
		const lineBox = foldedLine.getBoundingClientRect();
		const unfoldBox = unfold.element().getBoundingClientRect();
		expect(
			Math.abs(unfoldBox.top + unfoldBox.height / 2 - (lineBox.top + lineBox.height / 2)),
		).toBeLessThan(1);
		await screen.unmount();
	});

	it('returns a folded note to its folded line when the dismissal is cancelled', async () => {
		const screen = await renderNote();
		await screen.getByRole('button', { name: m.wishlist_note_fold() }).click();
		await screen.getByRole('button', { name: m.wishlist_note_dismiss() }).click();
		await screen.getByRole('button', { name: m.wishlist_note_keep() }).click();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_unfold() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('reopens a dismissed note when the shared state is restored', async () => {
		const screen = await renderNote();
		await screen.getByRole('button', { name: m.wishlist_note_dismiss() }).click();
		await screen
			.getByRole('button', { name: m.wishlist_note_dismiss_confirm(), exact: true })
			.click();
		await expect.element(screen.getByTestId('wishlist-note')).not.toBeInTheDocument();

		const visibility = wishlistNoteVisibility(wishlistId);
		expect(visibility.current).toBe(WISHLIST_NOTE_STATES.dismissed);
		visibility.current = WISHLIST_NOTE_STATES.open;
		flushSync();

		await expect.element(screen.getByText(/Budu mít 30!/)).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.wishlist_note_fold() }))
			.toBeVisible();
		await screen.unmount();
	});

	it('previews the open note without controls, regardless of the stored state', async () => {
		wishlistNoteVisibility(wishlistId).current = WISHLIST_NOTE_STATES.dismissed;
		const screen = await renderNote({ preview: true });
		await expect.element(screen.getByText(/Budu mít 30!/)).toBeVisible();
		expect(screen.getByRole('button').elements()).toHaveLength(0);
		await screen.unmount();
	});

	it('uses the neutral label without an author', async () => {
		const screen = await renderNote({ authorName: null });
		await expect.element(screen.getByText(m.wishlist_note_untitled())).toBeVisible();
		await screen.unmount();
	});
});

describe('wishlistNoteAuthorName', () => {
	it('names the linked recipient on their own list', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: false,
				recipientDisplayName: 'Martin Novák',
				managerNames: ['Jana', 'Petr'],
			}),
		).toBe('Martin Novák');
	});

	it('names the single správce of a list for someone else', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: true,
				recipientDisplayName: 'Anička',
				managerNames: ['Jana Nováková'],
			}),
		).toBe('Jana Nováková');
	});

	it('names nobody when a list for someone else has no správce', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: true,
				recipientDisplayName: 'Anička',
				managerNames: [],
			}),
		).toBeNull();
	});

	it('names nobody when the single správce has a blank name', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: true,
				recipientDisplayName: 'Anička',
				managerNames: ['  '],
			}),
		).toBeNull();
	});

	it('names nobody when the recipient of a self list has a blank name', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: false,
				recipientDisplayName: ' ',
				managerNames: ['Jana'],
			}),
		).toBeNull();
	});

	it('names nobody when several správci manage a list for someone else', () => {
		expect(
			wishlistNoteAuthorName({
				isForSomeoneElse: true,
				recipientDisplayName: 'Anička',
				managerNames: ['Jana', 'Petr'],
			}),
		).toBeNull();
	});
});
