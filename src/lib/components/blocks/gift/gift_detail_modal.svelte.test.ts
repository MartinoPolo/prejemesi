import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { GiftByRole } from '$lib/modules/gifts/types.js';
import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';
import { getLocale, setLocale, type Locale } from '$lib/paraglide/runtime.js';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { resolvedCssLength } from './gift_action_geometry.test_fixtures.js';

// Same stub as gift_detail_form.svelte.test.ts: the images module barrel reads
// `$env/dynamic/public`, which vitest-browser-svelte's bare document doesn't seed.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { expectPixelsAtLeast } = createPixelAssertions(expect);

const { default: GiftDetailModal } = await import('./GiftDetailModal.svelte');

function makeGift(overrides: Partial<GiftByRole> = {}): GiftByRole {
	return {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Ledové království',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: 300,
		priceMax: null,
		currency: 'CZK',
		imageUrl: '',
		imageKey: '',
		imageMeta: null,
		images: [],
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryIds: [],
		categories: [],
		...overrides,
	};
}

const baseProps = {
	open: true,
	wishlistId: 'wishlist-1',
	priorityLevels: [],
	postShareLocked: false,
	canDelete: false,
	isSubmitting: false,
	isDeleting: false,
};

describe('GiftDetailModal focus contract', () => {
	it.each([
		{ name: 'desktop', width: 1280, height: 800 },
		{ name: 'mobile', width: 390, height: 844 },
	])('owns focus without opening the $name text editor', async ({ width, height }) => {
		await page.viewport(width, height);
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onclose,
		});

		const dialog = screen.getByRole('dialog').element() as HTMLDivElement;
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() }).element();
		await expect.poll(() => document.activeElement).toBe(dialog);
		expect(nameInput).not.toBe(document.activeElement);

		await userEvent.tab();
		expect(dialog.contains(document.activeElement)).toBe(true);
		expect(document.activeElement).not.toBe(dialog);

		await userEvent.keyboard('{Escape}');
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.poll(() => onclose.mock.calls.length).toBe(1);
	});
});

describe('GiftDetailModal read-only viewer without a gift', () => {
	it('opens no dialog and renders no editor chrome', async () => {
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: null,
			readOnly: true,
		});

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('gift-editor-header')).not.toBeInTheDocument();
		await expect.element(screen.getByTestId('gift-viewer')).not.toBeInTheDocument();
		expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
	});
});

describe('GiftDetailModal editor layout and exit safety', () => {
	it('keeps the localized title beside the reserved close target at narrow enlarged text', async () => {
		const originalLocale = getLocale();
		const originalFontSize = document.documentElement.style.fontSize;
		await page.viewport(280, 700);
		document.documentElement.style.fontSize = '32px';
		try {
			for (const locale of ['cs', 'en'] satisfies Locale[]) {
				await setLocale(locale, { reload: false });
				const screen = await render(GiftDetailModal, {
					...baseProps,
					mode: 'edit' as const,
					gift: makeGift({
						imageUrl:
							'data:image/svg+xml,' +
							encodeURIComponent(
								'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>',
							),
					}),
				});
				const title = screen.getByRole('heading', { name: m.gift_edit_title() });
				const close = screen.getByRole('button', { name: m.close() }).first();
				await expect.element(title).toBeVisible();
				await expect.element(close).toBeVisible();
				const titleRect = title.element().getBoundingClientRect();
				const closeRect = close.element().getBoundingClientRect();
				expect(titleRect.right).toBeLessThanOrEqual(closeRect.left);
				const titleCenter = titleRect.top + titleRect.height / 2;
				const closeCenter = closeRect.top + closeRect.height / 2;
				expect(Math.abs(titleCenter - closeCenter)).toBeLessThan(1);
				const dialogRect = screen.getByRole('dialog').element().getBoundingClientRect();
				const framingGroupName = m.gift_image_framing_label({
					target: m.gift_image_target_card(),
				});
				for (const groupName of [framingGroupName, m.image_background_label()]) {
					const groupRect = screen
						.getByRole('group', { name: groupName })
						.element()
						.getBoundingClientRect();
					expect(groupRect.right).toBeLessThanOrEqual(dialogRect.right);
				}
				const footer = screen.getByTestId('gift-mobile-submit-footer');
				await expect.element(footer.getByRole('button', { name: m.save() })).toBeVisible();
				await expect
					.element(footer.getByRole('button', { name: m.cancel() }))
					.toBeVisible();
				await screen.unmount();
			}
		} finally {
			document.documentElement.style.fontSize = originalFontSize;
			await setLocale(originalLocale, { reload: false });
		}
	});

	it('keeps mobile fields before one workshop and desktop image left of details', async () => {
		await page.viewport(390, 844);
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
		});

		const title = screen.getByRole('heading', { name: m.gift_edit_title() });
		await expect.element(title).toBeVisible();
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() }).element();
		const imageSource = screen.getByRole('group', { name: m.gift_image_label() }).element();
		const imageWorkshop = screen.getByTestId('gift-image-column').element();
		expect(
			nameInput.compareDocumentPosition(imageSource) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			imageSource.compareDocumentPosition(imageWorkshop) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(screen.getByTestId('gift-image-column').all()).toHaveLength(1);

		await page.viewport(1280, 800);
		const desktopWorkshop = screen.getByTestId('gift-image-column').element();
		const detailColumn = screen.getByTestId('gift-detail-column').element();
		const imageRect = desktopWorkshop.getBoundingClientRect();
		const detailRect = detailColumn.getBoundingClientRect();
		expect(imageRect.left).toBeLessThan(detailRect.left);
		expect(Math.abs(imageRect.right - detailRect.left)).toBeLessThan(1);
	});

	it.each(['soft', 'ink', 'black'] as const)(
		'starts desktop editor fields below the close button and its %s depth gap',
		async (depth) => {
			document.documentElement.dataset.depth = depth;
			try {
				await page.viewport(1280, 800);
				const screen = await render(GiftDetailModal, {
					...baseProps,
					mode: 'edit' as const,
					gift: makeGift(),
				});
				const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
				await expect.element(nameInput).toBeVisible();
				await Promise.all(document.getAnimations().map((animation) => animation.finished));
				const nameLabel = document.querySelector<HTMLElement>('label[for="gift-name"]')!;
				const closeRect = document
					.querySelector('[data-slot="dialog-close"]')!
					.getBoundingClientRect();
				const nestedControlGap = resolvedCssLength(nameLabel, 'var(--nested-control-gap)');

				expectPixelsAtLeast(
					nameLabel.getBoundingClientRect().top,
					closeRect.bottom + nestedControlGap,
				);
			} finally {
				delete document.documentElement.dataset.depth;
			}
		},
	);

	it('closes unchanged and guards Cancel, close, and Escape on mobile', async () => {
		await page.viewport(390, 844);
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onclose,
		});

		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		await expect.poll(() => onclose.mock.calls.length).toBe(1);

		await screen.rerender({ open: true });
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Changed gift');
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.unsaved_changes_continue_editing() }).click();
		await expect.element(nameInput).toHaveValue('Changed gift');

		await screen.getByRole('button', { name: m.close() }).first().click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.unsaved_changes_continue_editing() }).click();

		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.unsaved_changes_discard() }).click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('keeps desktop Cancel visible and guards it after an edit', async () => {
		await page.viewport(1280, 800);
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Changed gift');
		const cancelButton = screen.getByRole('button', { name: m.cancel() }).first();
		await expect.element(cancelButton).toBeVisible();
		await cancelButton.click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
	});

	it('guards dirty outside-backdrop dismissal', async () => {
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Changed gift');
		const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
		expect(overlay).not.toBeNull();
		overlay!.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerType: 'mouse',
			}),
		);
		overlay!.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				pointerType: 'mouse',
			}),
		);
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
	});

	it('saves through the unsaved-changes guard and then closes the editor', async () => {
		const onupdate = vi.fn(() => true);
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onupdate,
			onclose,
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Saved gift');
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await screen.getByRole('button', { name: m.unsaved_changes_save_continue() }).click();

		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(onupdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Saved gift' }));
		await expect.poll(() => onclose.mock.calls.length).toBe(1);
	});

	it('keeps the editor open with its error when the guard save fails validation', async () => {
		const onupdate = vi.fn(() => true);
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onupdate,
			onclose,
		});
		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('');
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await screen.getByRole('button', { name: m.unsaved_changes_save_continue() }).click();

		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByText(m.gift_name_required())).toBeVisible();
		await expect
			.element(screen.getByRole('heading', { name: m.gift_edit_title() }))
			.toBeVisible();
		expect(onupdate).not.toHaveBeenCalled();
		expect(onclose).not.toHaveBeenCalled();
	});

	it('keeps the editor open when the guard save is rejected', async () => {
		const onclose = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onupdate: () => false,
			onclose,
		});
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Unsaved gift');
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await screen.getByRole('button', { name: m.unsaved_changes_save_continue() }).click();

		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.not.toBeInTheDocument();
		await expect.element(nameInput).toHaveValue('Unsaved gift');
		expect(onclose).not.toHaveBeenCalled();
	});

	it('keeps programmatically normalized legacy manual geometry clean and unchanged on save', async () => {
		const legacyImageMeta = {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
			focal: { x: 40, y: 40 },
			zoom: 1.4,
			bgColor: null,
		};
		const imageUrl =
			'data:image/svg+xml,' +
			encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"/>',
			);
		const firstScreen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({ imageUrl, imageMeta: legacyImageMeta }),
		});
		await expect.element(firstScreen.getByTestId('crop-stage-window')).toBeVisible();
		await firstScreen.getByRole('button', { name: m.cancel() }).first().click();
		await expect.element(firstScreen.getByRole('dialog')).not.toBeInTheDocument();
		await firstScreen.unmount();

		const onupdate = vi.fn();
		const secondScreen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({ imageUrl, imageMeta: legacyImageMeta }),
			onupdate,
		});
		await secondScreen.getByRole('button', { name: m.save() }).first().click();
		expect(onupdate).toHaveBeenCalledWith(
			expect.objectContaining({
				images: [expect.objectContaining({ imageMeta: legacyImageMeta })],
			}),
		);
	});

	it('allows normal wheel scrolling when a static crop stage is disabled', async () => {
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({
				imageUrl:
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>',
					),
			}),
			isSubmitting: true,
		});
		const cropStage = screen.getByTestId('crop-stage').element();
		const wheelEvent = new WheelEvent('wheel', {
			bubbles: true,
			cancelable: true,
			deltaY: -100,
		});

		expect(cropStage.dispatchEvent(wheelEvent)).toBe(true);
		expect(wheelEvent.defaultPrevented).toBe(false);
	});

	it('guards image presentation edits', async () => {
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({
				imageUrl:
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>',
					),
				imageMeta: {
					fitMode: IMAGE_FIT_MODES.containPadded,
					cropRect: null,
					focal: { x: 50, y: 50 },
					zoom: 1,
					bgColor: null,
				},
			}),
		});

		await screen.getByRole('radio', { name: m.image_background_black() }).click();
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
	});

	it('treats a persisted manual crop restored to its initial rectangle as clean', async () => {
		const initialCropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({
				imageUrl:
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>',
					),
				imageMeta: {
					fitMode: IMAGE_FIT_MODES.coverCrop,
					cropRect: null,
					focal: { x: 50, y: 50 },
					zoom: 1,
					bgColor: null,
					targets: {
						square: {
							cropRect: initialCropRect,
							focal: { x: 50, y: 50 },
							zoom: 1.25,
						},
					},
				},
			}),
		});
		const cropStage = screen.getByTestId('crop-stage');
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		cropStage
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.unsaved_changes_continue_editing() }).click();

		cropStage
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(document.body.textContent?.includes(m.unsaved_changes_title())).toBe(false);
	});

	it('treats a draft reverted to its initial values as clean', async () => {
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
		});

		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Changed gift');
		await nameInput.fill('Ledové království');
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
		expect(document.body.textContent?.includes(m.unsaved_changes_title())).toBe(false);
	});

	it('keeps dirty state after a failed save and closes after a successful save', async () => {
		const onupdate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			onupdate,
		});

		await screen.getByRole('textbox', { name: m.gift_name_label() }).fill('Changed gift');
		await screen.getByRole('button', { name: m.save() }).first().click();
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		await screen.getByRole('button', { name: m.cancel() }).first().click();
		await expect
			.element(screen.getByRole('heading', { name: m.unsaved_changes_title() }))
			.toBeVisible();
		await screen.getByRole('button', { name: m.unsaved_changes_continue_editing() }).click();

		await screen.getByRole('button', { name: m.save() }).first().click();
		await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
	});
});

describe('GiftDetailModal form identity (2026-08-04 data-corruption incident)', () => {
	// The `?gift=` deep-link effect can legitimately flip the modal from create to edit
	// while it is open. The form must NOT carry typed field state across that swap:
	// retained values would be submitted as an update to the OTHER gift, silently
	// overwriting it (this renamed a reserved production gift). The {#key} on
	// mode + gift id forces a remount, so the edit form reseeds from the gift row.
	it('reseeds the form when mode/gift swap under an open modal', async () => {
		const oncreate = vi.fn();
		const onupdate = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			oncreate,
			onupdate,
		});

		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('Králík je taky jenom člověk');
		await expect.element(nameInput).toHaveValue('Králík je taky jenom člověk');

		await screen.rerender({ mode: 'edit' as const, gift: makeGift() });

		// Remounted + reseeded: the typed create-mode value must be gone.
		const reseededNameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await expect.element(reseededNameInput).toHaveValue('Ledové království');

		// Submitting now sends the gift's own data — never the retained typed values.
		// Desktop and mobile footers each render a submit button; either proves the point.
		await screen.getByRole('button', { name: m.save() }).first().click();
		expect(oncreate).not.toHaveBeenCalled();
		expect(onupdate).toHaveBeenCalledOnce();
		expect(onupdate.mock.calls[0]![0]).toMatchObject({
			id: 'gift-1',
			name: 'Ledové království',
		});
	});
});

describe('GiftDetailModal first-change confirmation (issue #479)', () => {
	function deferredConfirmation() {
		const pending: Array<(confirmed: boolean) => void> = [];
		const confirmChange = vi.fn(() => new Promise<boolean>((resolve) => pending.push(resolve)));
		return { confirmChange, answer: (confirmed: boolean) => pending.shift()?.(confirmed) };
	}

	it('asks on the first edit, not on opening, and reverts a declined edit', async () => {
		const { confirmChange, answer } = deferredConfirmation();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			confirmChange,
		});
		const nameInput = () => screen.getByRole('textbox', { name: m.gift_name_label() });
		await expect.element(nameInput()).toBeVisible();
		expect(confirmChange).not.toHaveBeenCalled();

		await nameInput().fill('Changed gift');
		await expect.poll(() => confirmChange.mock.calls.length).toBe(1);
		answer(false);
		await expect.element(nameInput()).toHaveValue('Ledové království');

		await nameInput().fill('Changed again');
		await expect.poll(() => confirmChange.mock.calls.length).toBe(2);
		answer(true);
		await nameInput().fill('Changed once more');
		await expect.element(nameInput()).toHaveValue('Changed once more');
		expect(confirmChange).toHaveBeenCalledTimes(2);
	});

	it('asks before Delete enters its confirm step', async () => {
		const { confirmChange, answer } = deferredConfirmation();
		const ondelete = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift(),
			canDelete: true,
			confirmChange,
			ondelete,
		});

		await screen.getByRole('button', { name: m.gift_delete() }).first().click();
		await expect.poll(() => confirmChange.mock.calls.length).toBe(1);
		answer(false);
		await expect
			.element(screen.getByRole('button', { name: m.gift_delete() }).first())
			.toBeVisible();

		await screen.getByRole('button', { name: m.gift_delete() }).first().click();
		await expect.poll(() => confirmChange.mock.calls.length).toBe(2);
		answer(true);
		await screen.getByRole('button', { name: m.gift_delete_confirm() }).first().click();
		expect(ondelete).toHaveBeenCalledWith('gift-1');
	});

	it('never asks when adding a gift', async () => {
		const { confirmChange } = deferredConfirmation();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'create' as const,
			gift: null,
			confirmChange,
		});
		const nameInput = screen.getByRole('textbox', { name: m.gift_name_label() });
		await nameInput.fill('New gift');
		await expect.element(nameInput).toHaveValue('New gift');
		expect(confirmChange).not.toHaveBeenCalled();
	});
});

describe('GiftDetailModal fixed-window image editor (#533)', () => {
	const photoUrl =
		'data:image/svg+xml,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>');
	const fillMeta = {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor: null,
	};

	async function renderEditor(imageMeta: GiftByRole['imageMeta'] = fillMeta) {
		await page.viewport(1280, 800);
		const onupdate = vi.fn();
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({ imageUrl: photoUrl, imageMeta }),
			onupdate,
		});
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		return { screen, onupdate };
	}

	function pressOnStage(screen: Awaited<ReturnType<typeof renderEditor>>['screen'], key: string) {
		screen
			.getByTestId('crop-stage')
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	}

	it('draws the crop window at the card real size, or labels how much it is reduced', async () => {
		const { screen } = await renderEditor();
		// The modal layout settles after the image loads, so read size and badge together.
		const readWindow = () => {
			const window = screen
				.getByTestId('crop-stage-window')
				.element()
				.getBoundingClientRect();
			const scale = window.width / 356;
			return {
				scale,
				heightMatchesAspect: Math.abs(window.height - 267 * scale) < 1,
				badgeMatches:
					screen.getByTestId('crop-stage-size').element().textContent?.trim() ===
					(scale > 0.995
						? m.image_crop_true_size({ width: 356, height: 267 })
						: m.image_crop_scaled_size({
								width: 356,
								height: 267,
								percent: Math.round(scale * 100),
							})),
			};
		};
		await expect.poll(() => readWindow().badgeMatches).toBe(true);
		const { scale, heightMatchesAspect } = readWindow();
		expect(scale).toBeLessThanOrEqual(1);
		expect(heightMatchesAspect).toBe(true);
	});

	const statusOf = (screen: Awaited<ReturnType<typeof renderEditor>>['screen'], tile: string) =>
		screen.getByTestId(`gift-preview-status-${tile}`);

	async function savedImageMeta(
		screen: Awaited<ReturnType<typeof renderEditor>>['screen'],
		onupdate: ReturnType<typeof vi.fn>,
	) {
		await screen.getByRole('button', { name: m.save() }).first().click();
		return onupdate.mock.calls[0]![0].images[0].imageMeta;
	}

	it('selects a view from its tile and shows that view’s own preset and copy action', async () => {
		const { screen } = await renderEditor();
		await expect
			.element(screen.getByRole('button', { name: m.gift_image_copy_framing_to_thumb() }))
			.toBeVisible();
		await screen.getByTestId('gift-preview-tile-thumb').click();
		await expect
			.element(screen.getByTestId('crop-stage-editing'))
			.toHaveTextContent(m.image_crop_editing({ target: m.gift_image_target_thumb() }));
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fill() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect
			.element(screen.getByRole('button', { name: m.gift_image_copy_framing_to_card() }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_manual() }))
			.not.toBeInTheDocument();
	});

	it('marks only the edited Karta as Vlastní and pins both views when they differ', async () => {
		const { screen, onupdate } = await renderEditor();
		pressOnStage(screen, '+');
		await expect
			.element(statusOf(screen, 'square'))
			.toHaveTextContent(m.gift_image_framing_custom());
		await expect.element(statusOf(screen, 'thumb')).toHaveTextContent(m.image_fit_fill());
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fill() }))
			.toHaveAttribute('aria-checked', 'false');

		const imageMeta = await savedImageMeta(screen, onupdate);
		expect(imageMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(Object.keys(imageMeta.targets).sort()).toEqual(['square', 'thumb']);
		expect(imageMeta.targets.square.zoom).toBeGreaterThan(1);
		expect(imageMeta.targets.thumb.zoom).toBeCloseTo(1, 6);
		expect(imageMeta.targets.thumb.focal).toEqual({ x: 50, y: 50 });
	});

	it('keeps Vyplnit when a key cannot move the window or is a browser shortcut', async () => {
		const { screen } = await renderEditor();
		// The 4:3 photo exactly fills the 4:3 card window, so there is nothing to pan.
		pressOnStage(screen, 'ArrowRight');
		screen
			.getByTestId('crop-stage')
			.element()
			.dispatchEvent(
				new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true }),
			);
		await expect
			.element(screen.getByRole('radio', { name: m.image_fit_fill() }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(statusOf(screen, 'square')).toHaveTextContent(m.image_fit_fill());
	});

	it('zooms in on wheel up and pans with the arrow keys in the pressed direction', async () => {
		const { screen, onupdate } = await renderEditor();
		// Wheel zoom anchors at the pointer, so aim at the window center.
		const window = screen.getByTestId('crop-stage-window').element().getBoundingClientRect();
		screen
			.getByTestId('crop-stage')
			.element()
			.dispatchEvent(
				new WheelEvent('wheel', {
					deltaY: -200,
					clientX: window.left + window.width / 2,
					clientY: window.top + window.height / 2,
					bubbles: true,
					cancelable: true,
				}),
			);
		await expect
			.element(statusOf(screen, 'square'))
			.toHaveTextContent(m.gift_image_framing_custom());
		pressOnStage(screen, 'ArrowRight');
		pressOnStage(screen, 'ArrowDown');

		const square = (await savedImageMeta(screen, onupdate)).targets.square;
		expect(square.zoom).toBeGreaterThan(1);
		expect(square.focal.x).toBeGreaterThan(50);
		expect(square.focal.y).toBeGreaterThan(50);
	});

	it('leaves Karta on its centered cover when only Seznam is edited', async () => {
		const { screen, onupdate } = await renderEditor();
		await screen.getByTestId('gift-preview-tile-thumb').click();
		pressOnStage(screen, '+');
		await expect
			.element(statusOf(screen, 'thumb'))
			.toHaveTextContent(m.gift_image_framing_custom());
		await expect.element(statusOf(screen, 'square')).toHaveTextContent(m.image_fit_fill());

		const { targets } = await savedImageMeta(screen, onupdate);
		expect(targets.thumb.zoom).toBeGreaterThan(1);
		expect(targets.square.zoom).toBeCloseTo(1, 6);
		expect(targets.square.focal).toEqual({ x: 50, y: 50 });
	});

	it('shows Celý for the whole photo and steps in from it', async () => {
		const { screen, onupdate } = await renderEditor();
		await screen.getByTestId('gift-preview-tile-thumb').click();
		await screen.getByRole('radio', { name: m.image_crop_whole() }).click();
		await expect.element(statusOf(screen, 'thumb')).toHaveTextContent(m.image_crop_whole());
		await expect.element(statusOf(screen, 'square')).toHaveTextContent(m.image_fit_fill());
		pressOnStage(screen, '+');
		await expect
			.element(statusOf(screen, 'thumb'))
			.toHaveTextContent(m.gift_image_framing_custom());

		// The whole 4:3 photo in the square window is zoom 0.75; Vyplnit would start at 1.
		const thumb = (await savedImageMeta(screen, onupdate)).targets.thumb;
		expect(thumb.zoom).toBeGreaterThan(0.75);
		expect(thumb.zoom).toBeLessThan(1);
	});

	it('copies Karta to Seznam once, so a later Karta edit leaves Seznam alone', async () => {
		const { screen, onupdate } = await renderEditor();
		pressOnStage(screen, '+');
		pressOnStage(screen, '+');
		await expect
			.element(statusOf(screen, 'square'))
			.toHaveTextContent(m.gift_image_framing_custom());
		const zoomPercentAtCopy = Number.parseInt(
			screen.getByTestId('crop-stage-zoom').element().textContent ?? '',
			10,
		);
		await screen.getByRole('button', { name: m.gift_image_copy_framing_to_thumb() }).click();
		await expect
			.element(statusOf(screen, 'thumb'))
			.toHaveTextContent(m.gift_image_framing_custom());
		pressOnStage(screen, '+');

		const { targets } = await savedImageMeta(screen, onupdate);
		expect(Math.round(targets.thumb.zoom * 100)).toBe(zoomPercentAtCopy);
		expect(targets.square.zoom * 100).toBeGreaterThan(zoomPercentAtCopy + 1);
	});

	it('saves both views back on Vyplnit as a plain cover without targets', async () => {
		const { screen, onupdate } = await renderEditor({
			...fillMeta,
			targets: {
				square: {
					cropRect: { x: 0.1, y: 0.2, w: 2 / 3, h: 2 / 3 },
					focal: { x: 30, y: 60 },
					zoom: 1.5,
				},
				thumb: {
					cropRect: { x: 0.1, y: 0.1, w: 0.5, h: 2 / 3 },
					focal: { x: 20, y: 30 },
					zoom: 1.5,
				},
			},
		});
		await expect
			.element(statusOf(screen, 'thumb'))
			.toHaveTextContent(m.gift_image_framing_custom());
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await screen.getByTestId('gift-preview-tile-thumb').click();
		await screen.getByRole('radio', { name: m.image_fit_fill() }).click();
		await expect.element(statusOf(screen, 'square')).toHaveTextContent(m.image_fit_fill());
		await expect.element(statusOf(screen, 'thumb')).toHaveTextContent(m.image_fit_fill());

		const imageMeta = await savedImageMeta(screen, onupdate);
		expect(imageMeta.fitMode).toBe(IMAGE_FIT_MODES.coverCrop);
		expect(imageMeta.targets).toBeUndefined();
	});

	it('opens a list thumbnail following the card crop without asking about changes', async () => {
		await page.viewport(1280, 800);
		const confirmChange = vi.fn(() => Promise.resolve(true));
		const screen = await render(GiftDetailModal, {
			...baseProps,
			mode: 'edit' as const,
			gift: makeGift({
				imageUrl: photoUrl,
				imageMeta: {
					...fillMeta,
					targets: {
						square: {
							cropRect: { x: 0.1, y: 0.2, w: 2 / 3, h: 2 / 3 },
							focal: { x: 30, y: 60 },
							zoom: 1.5,
						},
					},
				},
			}),
			confirmChange,
		});
		await expect.element(screen.getByTestId('crop-stage-window')).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: m.gift_image_copy_framing_to_thumb() }))
			.toBeEnabled();
		await expect
			.element(statusOf(screen, 'thumb'))
			.toHaveTextContent(m.gift_image_framing_custom());
		expect(confirmChange).not.toHaveBeenCalled();

		pressOnStage(screen, '+');
		await expect.poll(() => confirmChange.mock.calls.length).toBe(1);
	});
});
