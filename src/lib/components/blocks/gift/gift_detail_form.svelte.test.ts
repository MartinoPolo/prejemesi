// The dense-alignment suite below measures computed geometry (control heights,
// grid columns, label-row baselines), so the real compiled Tailwind utilities must
// be present — the bare `client` browser project doesn't load them otherwise
// (only `.storybook/preview.ts` imports app.css). Mirror that import here.
import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_FIT_MODES, type ImageMetadata } from '$lib/modules/images/index.js';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';

// `GiftDetailForm` transitively imports `public_url.ts`, whose public env is normally
// seeded by SvelteKit's browser bootstrap. Vitest mounts into a bare document, so use
// the static root as the public image base; stored demo keys then load without calling
// the SvelteKit `/api/upload` endpoint.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_R2_URL: '/' } }));

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
	role: 'recipient' as const,
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

const categoryOptions: ManagedGiftCategory[] = [
	{
		id: 'category-books',
		presetKey: null,
		customLabel: 'Books',
		color: '#2563EB',
		sortOrder: 0,
		usedCount: 1,
	},
];

describe('GiftDetailForm categories', () => {
	it('renders category selection in create mode and submits the chosen category', async () => {
		const oncreate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			categoryOptions,
			oncreate,
		});

		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('New book');
		await screen.getByRole('button', { name: m.gift_category_none() }).click();
		await screen.getByRole('option', { name: 'Books' }).click();
		await screen.getByRole('button', { name: m.gift_add_title() }).first().click();

		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({ categoryId: 'category-books' }),
		);
	});

	it('keeps a long category list scrollable and supports keyboard selection', async () => {
		const manyCategories: ManagedGiftCategory[] = Array.from({ length: 30 }, (_, index) => ({
			id: `category-${index + 1}`,
			presetKey: null,
			customLabel: `Category ${index + 1}`,
			color: '#2563EB',
			sortOrder: index,
			usedCount: 1,
		}));
		const screen = await render(GiftDetailForm, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			categoryOptions: manyCategories,
		});

		const overflowStyle = document.createElement('style');
		overflowStyle.textContent = '[data-select-viewport] { max-height: 120px !important; }';
		document.head.append(overflowStyle);
		const trigger = screen.getByRole('button', { name: m.gift_category_none() });
		trigger.element().scrollIntoView({ block: 'center' });
		await trigger.click();
		const viewport = document.querySelector<HTMLElement>('[data-select-viewport]')!;
		expect(screen.getByRole('option').all()).toHaveLength(31);
		await vi.waitFor(() => {
			expect(viewport.clientHeight).toBeGreaterThan(0);
			expect(Number.isFinite(viewport.clientHeight)).toBe(true);
			expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
		});
		viewport.scrollIntoView({ block: 'center' });
		const rect = viewport.getBoundingClientRect();
		expect(rect.top).toBeGreaterThanOrEqual(0);
		expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);

		await userEvent.keyboard('{End}');
		const finalOption = screen.getByRole('option', { name: 'Category 30' }).element();
		await vi.waitFor(() => {
			expect(viewport.scrollTop).toBeGreaterThan(0);
			const viewportRect = viewport.getBoundingClientRect();
			const optionRect = finalOption.getBoundingClientRect();
			expect(optionRect.top).toBeGreaterThanOrEqual(viewportRect.top);
			expect(optionRect.bottom).toBeLessThanOrEqual(viewportRect.bottom + 1);
		});
		await userEvent.keyboard('{Enter}');
		await expect.element(screen.getByRole('button', { name: 'Category 30' })).toBeVisible();
		overflowStyle.remove();
	});

	it('preselects an edit gift category and submits null when it is cleared', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ categoryId: 'category-books' }),
			categoryOptions,
			onupdate,
		});

		await screen.getByRole('button', { name: 'Books' }).click();
		await screen.getByRole('option', { name: m.gift_category_none() }).click();
		await screen.getByRole('button', { name: m.save() }).first().click();

		expect(onupdate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: null }));
	});

	it('renders a disabled empty state with settings guidance', async () => {
		const screen = await render(GiftDetailForm, { ...baseProps, gift: makeGift() });

		await expect
			.element(screen.getByRole('button', { name: m.gift_category_none_enabled() }))
			.toBeDisabled();
		await expect.element(screen.getByText(m.gift_category_none_enabled_help())).toBeVisible();
	});
});

describe('GiftDetailForm actions (issue #255)', () => {
	it.each([WISHLIST_ROLES.recipient, WISHLIST_ROLES.moderator])(
		'does not render the received toggle in the editor for %s',
		async (role) => {
			await render(GiftDetailForm, { ...baseProps, role, gift: makeGift() });

			expect(document.querySelector('[data-testid="gift-received-toggle"]')).toBeNull();
		},
	);
});

describe('GiftDetailForm stored images', () => {
	it('previews the stored key while preserving the raw retailer URL on submit', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({
				imageUrl: 'https://shop.example/original.jpg',
				imageKey: 'demo/backpack.jpg',
			}),
			onupdate,
		});

		const mainPreview = document.querySelector('[data-testid="crop-stage"] img');
		const uploadPreview = document.querySelector('img[data-testid="image-upload-preview"]');
		expect(mainPreview?.getAttribute('src')).toBe('/demo/backpack.jpg');
		expect(uploadPreview?.getAttribute('src')).toBe('/demo/backpack.jpg');

		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({
				imageUrl: 'https://shop.example/original.jpg',
				imageKey: 'demo/backpack.jpg',
			}),
		);
	});
});

describe('GiftDetailForm image backgrounds (issue #252)', () => {
	const imageUrl =
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>');

	function imageMeta(bgColor: string | null): ImageMetadata {
		return {
			fitMode: IMAGE_FIT_MODES.containPadded,
			cropRect: null,
			focal: { x: 50, y: 50 },
			zoom: 1,
			bgColor,
		};
	}

	it('selects Transparent for null, previews the default pattern, and submits null untouched', async () => {
		const onupdate = vi.fn();
		const root = document.documentElement;
		const previousValue = root.style.getPropertyValue('--secondary');
		const previousPriority = root.style.getPropertyPriority('--secondary');
		root.style.setProperty('--secondary', 'rgb(12, 34, 56)');

		try {
			const screen = await render(GiftDetailForm, {
				...baseProps,
				gift: makeGift({ imageUrl, imageMeta: imageMeta(null) }),
				onupdate,
			});

			await expect
				.element(screen.getByRole('group', { name: m.image_background_label() }))
				.toBeVisible();
			await expect
				.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
				.toHaveAttribute('aria-checked', 'true');
			expect(
				screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
			).toBeTruthy();
			await vi.waitFor(() => {
				const fill = screen.container.querySelector<HTMLElement>(
					'[data-testid="crop-stage"] > [style*="background:"]',
				);
				expect(fill).not.toBeNull();
				expect(getComputedStyle(fill!).backgroundColor).toBe('rgb(12, 34, 56)');
			});

			await screen.getByRole('button', { name: m.save() }).click();
			expect(onupdate).toHaveBeenCalledWith(
				expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
			);
		} finally {
			if (previousValue) {
				root.style.setProperty('--secondary', previousValue, previousPriority);
			} else {
				root.style.removeProperty('--secondary');
			}
		}
	});

	it('normalizes legacy transparent metadata to the selected default and null on save', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('transparent') }),
			onupdate,
		});

		await expect
			.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeTruthy();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
		);
	});

	it('clicking Transparent replaces an explicit fill with canonical null', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('#000000') }),
			onupdate,
		});

		await screen.getByRole('radio', { name: m.image_background_transparent() }).click();
		await expect
			.element(screen.getByRole('radio', { name: m.image_background_transparent() }))
			.toHaveAttribute('aria-checked', 'true');
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeTruthy();
		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: null }) }),
		);
	});

	it.each([
		[m.image_background_white(), '#ffffff', 'rgb(255, 255, 255)'],
		[m.image_background_black(), '#000000', 'rgb(0, 0, 0)'],
	])('submits %s as the exact persisted value', async (label, value, expectedBackground) => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta(null) }),
			onupdate,
		});

		await screen.getByRole('radio', { name: label }).click();
		await vi.waitFor(() => {
			const fill = screen.container.querySelector<HTMLElement>(
				'[data-testid="crop-stage"] > [style*="background:"]',
			);
			expect(fill).not.toBeNull();
			expect(getComputedStyle(fill!).backgroundColor).toBe(expectedBackground);
		});
		expect(
			screen.container.querySelector('[data-testid="gift-preview-card-pattern"]'),
		).toBeNull();
		await screen.getByRole('button', { name: m.save() }).click();

		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ imageMeta: expect.objectContaining({ bgColor: value }) }),
		);
	});

	it('highlights the persisted explicit choice when editing a gift', async () => {
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ imageUrl, imageMeta: imageMeta('#000000') }),
		});

		await expect
			.element(screen.getByRole('radio', { name: m.image_background_black() }))
			.toHaveAttribute('aria-checked', 'true');
	});
});

describe('GiftDetailForm price-range UI (issue #171)', () => {
	it('reopens and submits a decimal single price (issue #250 REQ-1, REQ-4)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 19.5, priceMax: null, currency: 'EUR' }),
			onupdate,
		});

		const priceInput = document.querySelector('#gift-price');
		expect(priceInput).toHaveAttribute('step', '0.01');
		expect(priceInput).toHaveValue(19.5);

		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ price: 19.5, priceMax: null, currency: 'EUR' }),
		);
	});

	it('reopens and submits decimal range bounds (issue #250 REQ-1, REQ-4)', async () => {
		const onupdate = vi.fn();
		const screen = await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift({ price: 19.5, priceMax: 29.95, currency: 'EUR' }),
			onupdate,
		});

		const minInput = screen.getByRole('spinbutton', { name: m.gift_price_range_min_aria() });
		const maxInput = screen.getByRole('spinbutton', { name: m.gift_price_range_max_aria() });
		await expect.element(minInput).toHaveAttribute('step', '0.01');
		await expect.element(maxInput).toHaveAttribute('step', '0.01');
		await expect.element(minInput).toHaveValue(19.5);
		await expect.element(maxInput).toHaveValue(29.95);

		await screen.getByRole('button', { name: m.save() }).click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({ price: 19.5, priceMax: 29.95, currency: 'EUR' }),
		);
	});

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

describe('GiftDetailForm dense control alignment (issue #159)', () => {
	function expectAlignedControlPair(
		rowTestId: string,
		firstControlSelector: string,
		secondControlSelector: string,
	): void {
		const row = document.querySelector<HTMLElement>(`[data-testid="${rowTestId}"]`);
		expect(row).not.toBeNull();

		const fields = [...row!.children] as HTMLElement[];
		expect(fields.length).toBeGreaterThanOrEqual(2);
		const [firstFieldRect, secondFieldRect] = fields
			.slice(0, 2)
			.map((field) => field.getBoundingClientRect());
		expect(firstFieldRect.top).toBe(secondFieldRect.top);
		expect(firstFieldRect.left).not.toBe(secondFieldRect.left);
		expect(firstFieldRect.width).toBe(secondFieldRect.width);
		expect(firstFieldRect.left).toBeLessThan(secondFieldRect.left);
		expect(secondFieldRect.left - firstFieldRect.right).toBeGreaterThan(0);

		const firstControl = fields[0]!.querySelector<HTMLElement>(firstControlSelector);
		const secondControl = fields[1]!.querySelector<HTMLElement>(secondControlSelector);
		expect(firstControl).not.toBeNull();
		expect(secondControl).not.toBeNull();
		const firstControlRect = firstControl!.getBoundingClientRect();
		const secondControlRect = secondControl!.getBoundingClientRect();
		expect(firstControlRect.height).toBe(32);
		expect(secondControlRect.height).toBe(32);
		expect(firstControlRect.top).toBe(secondControlRect.top);
		expect(firstControlRect.bottom).toBe(secondControlRect.bottom);

		const labelRows = fields.map((field) =>
			field.querySelector<HTMLElement>('[data-slot="gift-form-label-row"]'),
		);
		expect(labelRows.every((labelRow) => labelRow !== null)).toBe(true);
		const [firstLabelRowRect, secondLabelRowRect] = labelRows.map((labelRow) =>
			labelRow!.getBoundingClientRect(),
		);
		expect(firstLabelRowRect.top).toBe(secondLabelRowRect.top);

		const [firstLabelRect, secondLabelRect] = labelRows.map((labelRow) =>
			labelRow!.querySelector('label')!.getBoundingClientRect(),
		);
		expect(firstLabelRect.top).toBe(secondLabelRect.top);
		expect(firstLabelRect.bottom).toBe(secondLabelRect.bottom);
	}

	it('aligns paired label rows and 32px controls for price, currency, quantity, and category', async () => {
		await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift(),
			priorityLevels: [
				{
					id: 'priority-medium',
					wishlistId: 'wishlist-1',
					sortOrder: 1,
					label: 'Stredni',
					createdAt: new Date('2026-01-01T00:00:00Z'),
				},
			],
		});

		expectAlignedControlPair(
			'gift-price-currency-row',
			'#gift-price',
			'[data-slot="select-trigger"]',
		);
		expectAlignedControlPair(
			'gift-quantity-priority-row',
			'#gift-quantity',
			'[data-slot="select-trigger"]',
		);
	});

	it('keeps quantity and the empty category control aligned when no priorities exist', async () => {
		await render(GiftDetailForm, {
			...baseProps,
			gift: makeGift(),
		});

		expectAlignedControlPair(
			'gift-quantity-priority-row',
			'#gift-quantity',
			'[data-slot="select-trigger"]',
		);
	});
});
