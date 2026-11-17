import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';
import { giftEditorPreview, type GiftEditorPreviewValues } from './gift_editor_preview.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftEditorPreviewTestHost } = await import('./GiftEditorPreviewTestHost.svelte');

const IMAGE_URL =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="teal"/></svg>',
	);

const LIVE_VALUES: GiftEditorPreviewValues = {
	wishlistId: 'wishlist-1',
	name: 'Stolní hra Carcassonne',
	description: 'Základní hra s řekou',
	descriptionAppends: [],
	links: [{ url: 'https://www.alza.cz/carcassonne' }],
	price: 899,
	priceMax: null,
	currency: 'CZK',
	quantity: 1,
	priorityLabel: 'Vysoka',
	categories: [
		{
			id: 'category-board-games',
			presetKey: null,
			customLabel: 'Deskovky',
			color: '#2f855a',
			sortOrder: 0,
		},
	],
	images: [
		{
			imageUrl: IMAGE_URL,
			imageKey: null,
			imageMeta: {
				fitMode: IMAGE_FIT_MODES.coverCrop,
				cropRect: null,
				focal: { x: 50, y: 50 },
				zoom: 1,
				bgColor: null,
			},
		},
	],
};

function renderPreview(values: GiftEditorPreviewValues, editable: boolean) {
	const onedit = vi.fn();
	const screen = render(GiftEditorPreviewTestHost, {
		gift: giftEditorPreview(values),
		editable,
		disabled: false,
		onedit,
	});
	return { screen, onedit, preview: screen.getByTestId('gift-editor-preview') };
}

describe('GiftEditorPreview', () => {
	it('shows the live name, description, link, price, priority and category', async () => {
		const { screen, preview } = renderPreview(LIVE_VALUES, true);

		await expect.element(preview.getByText('Stolní hra Carcassonne')).toBeVisible();
		await expect.element(preview.getByText('Základní hra s řekou')).toBeVisible();
		await expect.element(preview.getByText('alza.cz')).toBeVisible();
		await expect.element(preview.getByText(/899\sKč/)).toBeVisible();
		await expect.element(preview.getByText(m.gift_priority_high())).toBeVisible();
		await expect.element(preview.getByText('Deskovky')).toBeVisible();

		await screen.rerender({
			gift: giftEditorPreview({
				...LIVE_VALUES,
				name: 'Stolní hra Ticket to Ride',
				price: 1250,
			}),
		});
		await expect.element(preview.getByText('Stolní hra Ticket to Ride')).toBeVisible();
		await expect.element(preview.getByText(/1\s250\sKč/)).toBeVisible();
	});

	it('switches between the visitor card and the list row', async () => {
		const { preview } = renderPreview(LIVE_VALUES, true);
		await expect.element(preview.getByTestId('gift-card-body')).toBeInTheDocument();
		await expect.element(preview.getByTestId('gift-list-item')).not.toBeInTheDocument();

		await preview.getByRole('radio', { name: m.gift_view_list() }).click();
		await expect.element(preview.getByTestId('gift-list-item')).toBeVisible();
		await expect.element(preview.getByTestId('gift-card-body')).not.toBeInTheDocument();
		await expect.element(preview.getByText('Stolní hra Carcassonne')).toBeVisible();

		await preview.getByRole('radio', { name: m.gift_view_card() }).click();
		await expect.element(preview.getByTestId('gift-card-body')).toBeVisible();
		await expect.element(preview.getByTestId('gift-list-item')).not.toBeInTheDocument();
	});

	it('opens the framing step from the image entry in both views', async () => {
		const { preview, onedit } = renderPreview(LIVE_VALUES, true);

		await preview.getByRole('button', { name: m.gift_image_edit() }).click();
		await preview.getByRole('radio', { name: m.gift_view_list() }).click();
		await preview.getByRole('button', { name: m.gift_image_edit() }).click();

		expect(onedit).toHaveBeenCalledTimes(2);
	});

	it('shows the image placeholder and no edit entry for a new gift without an image', async () => {
		const { preview } = renderPreview({ ...LIVE_VALUES, name: '', images: [] }, false);

		await expect
			.element(preview.getByTestId('image-frame').getByRole('img'))
			.toHaveTextContent('🎁');
		await expect.element(preview.getByTestId('gift-image-edit-entry')).not.toBeInTheDocument();

		await preview.getByRole('radio', { name: m.gift_view_list() }).click();
		await expect.element(preview.getByTestId('gift-list-item')).toBeVisible();
		await expect.element(preview.getByTestId('gift-image-edit-entry')).not.toBeInTheDocument();
	});
});
