import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import { resolvedCssLength } from '../gift/gift_action_geometry.test_fixtures.js';
import { expectContentClearsOverlayClose } from '$lib/components/base/dialog/overlay_close_geometry.test_fixtures.js';
import * as m from '$lib/paraglide/messages.js';
import { WIZARD_MODE } from './import_wizard_types.js';

const importRemotes = vi.hoisted(() => ({
	fetchGoogleSheetCsv: vi.fn(),
	importGifts: vi.fn(),
	createWishlistFromImport: vi.fn(),
}));

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/import/import.remote.js', () => importRemotes);

const { default: ImportWizard } = await import('./ImportWizard.svelte');
const { expectPixelsAtLeast } = createPixelAssertions(expect);

function pasteEvent(text: string): ClipboardEvent {
	const clipboardData = new DataTransfer();
	clipboardData.setData('text/plain', text);
	return new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData });
}

afterEach(async () => {
	document.body.replaceChildren();
	delete document.documentElement.dataset.depth;
	await page.viewport(1280, 720);
});

describe('ImportWizard new-list title validation', () => {
	it('blocks blank and whitespace titles before advancing with a valid title', async () => {
		const screen = await render(ImportWizard, {
			open: true,
			mode: WIZARD_MODE.newList,
		});

		await screen.getByRole('radio', { name: m.import_wizard_source_paste() }).click();
		const pasteSurface = screen.getByPlaceholder(m.import_wizard_paste_placeholder());
		pasteSurface.element().dispatchEvent(pasteEvent('Name\tQuantity\nCamera\t1'));

		const titleInput = screen.getByLabelText(m.import_wizard_review_title_label());
		await expect.element(titleInput).toBeVisible();
		const nextButton = screen.getByRole('button', { name: m.import_wizard_next() });
		await vi.waitFor(() => expect(nextButton.element()).not.toBeDisabled());

		await nextButton.click();
		await expect.element(screen.getByText(m.wishlist_name_required())).toBeVisible();
		expect(
			screen.getByRole('button', { name: m.import_wizard_commit_new() }).elements(),
		).toHaveLength(0);

		await titleInput.fill('   ');
		await nextButton.click();
		await expect.element(screen.getByText(m.wishlist_name_required())).toBeVisible();
		expect(
			screen.getByRole('button', { name: m.import_wizard_commit_new() }).elements(),
		).toHaveLength(0);

		await titleInput.fill('Birthday gifts');
		await expect.element(screen.getByText(m.wishlist_name_required())).not.toBeInTheDocument();
		await nextButton.click();
		await expect
			.element(screen.getByRole('button', { name: m.import_wizard_commit_new() }))
			.toBeVisible();
	});
});

describe('ImportWizard header beside the close button', () => {
	describe.each(['soft', 'ink', 'black'] as const)('at %s depth', (depth) => {
		it.each([390, 1280])(
			'keeps the title row beside and the stepper below the close button at %ipx',
			async (viewportWidth) => {
				document.documentElement.dataset.depth = depth;
				await page.viewport(viewportWidth, 844);
				const screen = await render(ImportWizard, {
					open: true,
					mode: WIZARD_MODE.newList,
				});
				const stepper = screen.getByTestId('import-wizard-stepper');
				await expect.element(stepper).toBeVisible();
				await Promise.all(document.getAnimations().map((animation) => animation.finished));
				await document.fonts.ready;
				const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
				const closeButton = dialog.querySelector<HTMLElement>(
					'[data-slot="dialog-close"]',
				)!;
				const nestedControlGap = resolvedCssLength(dialog, 'var(--nested-control-gap)');

				expectPixelsAtLeast(
					stepper.element().getBoundingClientRect().top,
					closeButton.getBoundingClientRect().bottom + nestedControlGap,
				);
				expectContentClearsOverlayClose(
					screen.getByTestId('import-wizard-title-row').element() as HTMLElement,
					closeButton,
				);
			},
		);
	});
});
