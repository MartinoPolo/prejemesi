import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';

// `GiftDetailForm` transitively imports the images module barrel, which re-exports
// `public_url.ts`'s `$env/dynamic/public` usage. In the real app SvelteKit's page
// bootstrap script seeds `window.__sveltekit_dev.env` before the client entry runs;
// vitest-browser-svelte mounts into a bare document without that bootstrap, so the
// virtual module throws. Stub it – no production code touches this in tests.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDetailForm } = await import('./GiftDetailForm.svelte');

/** Minimal GiftForRecipient fixture (a GiftByRole member) for edit-mode rendering. */
function makeGift(overrides: Partial<GiftByRole> = {}): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Herní konzole',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 100,
		priceMax: null,
		currency: 'CZK',
		imageUrl: '',
		imageKey: '',
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		...overrides,
	};
}

const baseProps = {
	mode: 'edit' as const,
	wishlistId: 'wishlist-1',
	priorityLevels: [],
	isOwner: true,
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

describe('GiftDetailForm price-range UI (issue #171)', () => {
	it('defaults to single-price mode when the gift has no priceMax (REQ-1)', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: null }),
		});

		await expect
			.element(screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }))
			.not.toBeChecked();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.not.toBeInTheDocument();
	});

	it('opens in range mode when the gift already has a priceMax (REQ-1)', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
		});

		await expect
			.element(screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }))
			.toBeChecked();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() }))
			.toHaveValue(100);
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.toHaveValue(200);
	});

	it('shows the cross-field validation error and a11y wiring when max < min (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 200, priceMax: 100 }),
			onupdate,
		});

		await screen.getByRole('button', { name: m.save() }).click();

		const errorText = screen.getByText(m.gift_price_range_invalid());
		await expect.element(errorText).toBeVisible();

		// Assert the input-to-error association contract, not the hardcoded id string.
		const errorId = errorText.element().id;
		expect(errorId).not.toBe('');

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).toHaveAttribute('aria-invalid', 'true');
		await expect.element(minInput).toHaveAttribute('aria-describedby', errorId);
		await expect.element(maxInput).toHaveAttribute('aria-invalid', 'true');
		await expect.element(maxInput).toHaveAttribute('aria-describedby', errorId);

		expect(onupdate).not.toHaveBeenCalled();
	});

	it('requires both bounds before submitting a range (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: null }),
			onupdate,
		});

		// Turn range mode on without filling the newly-revealed max bound.
		await screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }).click();
		await screen.getByRole('button', { name: m.save() }).click();

		await expect.element(screen.getByText(m.gift_price_range_required())).toBeVisible();
		expect(onupdate).not.toHaveBeenCalled();
	});

	it('submits a valid range with no aria-invalid wiring (REQ-2)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
			onupdate,
		});

		await screen.getByRole('button', { name: m.save() }).click();

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).not.toHaveAttribute('aria-invalid');
		await expect.element(maxInput).not.toHaveAttribute('aria-invalid');

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'gift-1', price: 100, priceMax: 200 }),
		);
	});

	it('toggling range mode off clears priceMax and submits a single price (REQ-3)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 100, priceMax: 200 }),
			onupdate,
		});

		await screen.getByRole('switch', { name: m.gift_price_range_toggle_label() }).click();
		await expect
			.element(screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() }))
			.not.toBeInTheDocument();

		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'gift-1', price: 100, priceMax: null }),
		);
	});
});

describe('GiftDetailForm legacy `auto` normalization (issue #183 EXTRA)', () => {
	// A wide/landscape data-URI source: its natural ratio (400/100 = 4) diverges
	// from the 4:3 gift window (÷ 4/3 = 3.0) well past `AUTO_CONTAIN_RATIO_THRESHOLD`
	// (2), so a real `auto` render would letterbox (Fit/contain) rather than
	// cover-crop – exercising `resolveAutoFit` against a real measured image
	// instead of asserting the pure function in isolation.
	const landscapeImageUrl =
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"/>');

	it('normalizes an untouched legacy auto row to the Fit toggle without dirtying the mode (REQ-8)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({
				imageUrl: landscapeImageUrl,
				imageKey: 'legacy-key',
				imageMeta: {
					fitMode: IMAGE_FIT_MODES.auto,
					cropRect: null,
					focal: { x: 50, y: 50 },
					zoom: 1,
					bgColor: null,
				},
			}),
			onupdate,
		});

		// The toggle normalizes to Fit once the natural ratio is measured – purely
		// a presentation normalization (`presentedEditorMode`); the internal
		// `editorMode` stays at its `giftEditorModeFromMeta` default (`fill` for
		// any `auto` row) the whole time.
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fit() }))
			.toHaveAttribute('aria-checked', 'true');

		// Saving untouched must still persist `auto` verbatim (REQ-8). If the
		// measurement had incorrectly dirtied the mode, `savedFitMode` would
		// instead derive from the internal `fill` editorMode and persist
		// `cover-crop` here.
		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledTimes(1);
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({
				imageMeta: expect.objectContaining({ fitMode: IMAGE_FIT_MODES.auto }),
			}),
		);
	});
});
