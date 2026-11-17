import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import DialogTestFixture from './dialog_test_fixture.svelte';
import DialogStepsTestFixture from './dialog_steps_test_fixture.svelte';
import DialogScrollTestFixture from './dialog_scroll_test_fixture.svelte';
import { expectContentClearsOverlayClose } from './overlay_close_geometry.test_fixtures.js';
import { resolvedCssLength } from '$lib/components/blocks/gift/gift_action_geometry.test_fixtures.js';

afterEach(async () => {
	delete document.documentElement.dataset.depth;
	await page.viewport(1280, 720);
});

function titleLinesCollidingWithCloseButton(): number {
	const title = document.querySelector('[data-slot="dialog-title"]');
	const closeButton = document.querySelector('[data-slot="dialog-close"]');
	if (title === null || closeButton === null) {
		throw new Error('Missing dialog title or close button');
	}
	const close = closeButton.getBoundingClientRect();
	const range = document.createRange();
	range.selectNodeContents(title);
	return [...range.getClientRects()].filter(
		(line) =>
			line.right > close.left &&
			line.left < close.right &&
			line.bottom > close.top &&
			line.top < close.bottom,
	).length;
}

describe('Dialog title and close button', () => {
	it.each([
		[390, 'Obnovit toto demo?'],
		[390, 'Create a real account?'],
		[1280, 'Create a real account with a deliberately long dialog heading'],
	])('keeps the title clear of the close button at %ipx: %s', async (viewportWidth, title) => {
		await page.viewport(viewportWidth, 844);
		render(DialogTestFixture, { title });
		await expect.element(page.getByRole('heading', { name: title })).toBeVisible();
		expect(titleLinesCollidingWithCloseButton()).toBe(0);
	});

	it.each([
		['soft', 390],
		['soft', 1280],
		['ink', 390],
		['black', 390],
		['ink', 1280],
	] as const)(
		'reserves the close button and its depth gap beside the title at %s depth and %ipx',
		async (depth, viewportWidth) => {
			document.documentElement.dataset.depth = depth;
			await page.viewport(viewportWidth, 844);
			const titleText = 'Create a real account with a deliberately long dialog heading';
			render(DialogTestFixture, { title: titleText });
			const title = page.getByRole('heading', { name: titleText }).element() as HTMLElement;
			await expect.element(title).toBeVisible();
			await Promise.allSettled(
				document.getAnimations().map((animation) => animation.finished),
			);

			expectContentClearsOverlayClose(
				title,
				document.querySelector<HTMLElement>('[data-slot="dialog-close"]')!,
			);
		},
	);

	it('does not reserve close-button space when the dialog has no close button', async () => {
		await page.viewport(390, 844);
		render(DialogTestFixture, { title: 'No close button', showCloseButton: false });
		const title = page.getByRole('heading', { name: 'No close button' });
		await expect.element(title).toBeVisible();
		const style = getComputedStyle(title.element());
		expect(style.paddingInlineStart).toBe('0px');
		expect(style.paddingInlineEnd).toBe('0px');
	});
});

describe('Dialog back button', () => {
	function dialogPart(slot: string): HTMLElement {
		const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
		if (element === null) {
			throw new Error(`Missing ${slot}`);
		}
		return element;
	}

	it('sits at the start inset mirroring the close button and fires its click handler', async () => {
		const onBack = vi.fn();
		render(DialogStepsTestFixture, { title: 'Framing', onBack });
		const backButton = page.getByRole('button', { name: 'Back' });
		await expect.element(backButton).toBeVisible();
		await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));

		const content = dialogPart('dialog-content').getBoundingClientRect();
		const back = backButton.element().getBoundingClientRect();
		const close = dialogPart('dialog-close').getBoundingClientRect();
		expect(back.left - content.left).toBeCloseTo(content.right - close.right, 1);
		expect(back.top).toBeCloseTo(close.top, 1);
		expect(back.width).toBeCloseTo(close.width, 1);

		await backButton.click();
		expect(onBack).toHaveBeenCalledOnce();
	});

	it.each([
		['soft', 390],
		['soft', 1280],
		['ink', 390],
		['ink', 1280],
	] as const)(
		'reserves the back and close buttons on both sides of the title at %s depth and %ipx',
		async (depth, viewportWidth) => {
			document.documentElement.dataset.depth = depth;
			await page.viewport(viewportWidth, 844);
			const titleText = 'Upravit výřez fotky s dlouhým názvem dárku';
			render(DialogStepsTestFixture, { title: titleText, onBack: () => {} });
			const title = page.getByRole('heading', { name: titleText }).element() as HTMLElement;
			await expect.element(title).toBeVisible();
			await Promise.allSettled(
				document.getAnimations().map((animation) => animation.finished),
			);

			const style = getComputedStyle(title);
			const contentInlineStart =
				title.getBoundingClientRect().left + Number.parseFloat(style.paddingLeft);
			const nestedControlGap = resolvedCssLength(title, 'var(--nested-control-gap)');
			expect(contentInlineStart).toBeGreaterThanOrEqual(
				dialogPart('dialog-back').getBoundingClientRect().right + nestedControlGap - 0.5,
			);
			expect(style.paddingLeft).toBe(style.paddingRight);
			expectContentClearsOverlayClose(title, dialogPart('dialog-close'));
		},
	);

	it('leaves the title start unpadded on wider screens without a back button', async () => {
		await page.viewport(1280, 844);
		render(DialogStepsTestFixture, { title: 'Main step' });
		const title = page.getByRole('heading', { name: 'Main step' });
		await expect.element(title).toBeVisible();
		expect(document.querySelector('[data-slot="dialog-back"]')).toBeNull();
		expect(getComputedStyle(title.element()).paddingInlineStart).toBe('0px');
	});
});

describe('Dialog footer lead', () => {
	const deleteLead = createRawSnippet(() => ({
		render: () => '<button type="button">Delete</button>',
	}));

	it('places the lead at the start of the desktop row, apart from the end-aligned actions', async () => {
		await page.viewport(1280, 844);
		render(DialogStepsTestFixture, { title: 'Edit gift', lead: deleteLead });
		const deleteButton = page.getByRole('button', { name: 'Delete' });
		await expect.element(deleteButton).toBeVisible();
		await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));

		const footer = document.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;
		const lead = deleteButton.element().getBoundingClientRect();
		const cancel = page
			.getByRole('button', { name: 'Cancel' })
			.element()
			.getBoundingClientRect();
		const save = page.getByRole('button', { name: 'Save' }).element().getBoundingClientRect();
		expect(lead.left).toBeCloseTo(footer.getBoundingClientRect().left, 1);
		expect(lead.top).toBeCloseTo(cancel.top, 1);
		expect(cancel.left).toBeGreaterThan(lead.right);
		expect(save.right).toBeCloseTo(footer.getBoundingClientRect().right, 1);
	});

	it('stacks the lead below the actions on phones', async () => {
		await page.viewport(390, 844);
		render(DialogStepsTestFixture, { title: 'Edit gift', lead: deleteLead });
		const deleteButton = page.getByRole('button', { name: 'Delete' });
		await expect.element(deleteButton).toBeVisible();

		const lead = deleteButton.element().getBoundingClientRect();
		const cancel = page
			.getByRole('button', { name: 'Cancel' })
			.element()
			.getBoundingClientRect();
		expect(lead.top).toBeGreaterThanOrEqual(cancel.bottom);
	});

	it('renders no lead area by default', async () => {
		render(DialogStepsTestFixture, { title: 'Edit gift' });
		await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible();
		expect(document.querySelector('[data-slot="dialog-footer-lead"]')).toBeNull();
	});
});

describe('Dialog scroll layout', () => {
	function scrollDialogPart(slot: string): HTMLElement {
		const element = document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
		if (element === null) {
			throw new Error(`Missing ${slot}`);
		}
		return element;
	}

	it('caps the height, pins header and footer, and scrolls only the body', async () => {
		await page.viewport(390, 844);
		render(DialogScrollTestFixture, { paragraphCount: 80 });
		await expect.element(page.getByRole('heading', { name: 'Scrolling dialog' })).toBeVisible();
		await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
		const content = scrollDialogPart('dialog-content');
		const header = scrollDialogPart('dialog-header');
		const body = scrollDialogPart('dialog-body');
		const footer = scrollDialogPart('dialog-footer');

		expect(content.getBoundingClientRect().height).toBeLessThanOrEqual(844 * 0.85 + 1);
		expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);

		const footerTopBeforeScroll = footer.getBoundingClientRect().top;
		const headerTopBeforeScroll = header.getBoundingClientRect().top;
		body.scrollTop = body.scrollHeight;
		expect(body.scrollTop).toBeGreaterThan(0);
		expect(footer.getBoundingClientRect().top).toBe(footerTopBeforeScroll);
		expect(header.getBoundingClientRect().top).toBe(headerTopBeforeScroll);
		await expect.element(page.getByRole('button', { name: 'Save' })).toBeInViewport();
	});

	it('tints the footer above one thin border and divides the header only on request', async () => {
		render(DialogScrollTestFixture, { paragraphCount: 3, divided: true });
		await expect.element(page.getByRole('heading', { name: 'Scrolling dialog' })).toBeVisible();
		const footerStyle = getComputedStyle(scrollDialogPart('dialog-footer'));

		expect(footerStyle.borderTopWidth).toBe('1px');
		expect(footerStyle.borderBottomWidth).toBe('0px');
		expect(footerStyle.backgroundColor).not.toBe(
			getComputedStyle(scrollDialogPart('dialog-content')).backgroundColor,
		);
		expect(getComputedStyle(scrollDialogPart('dialog-header')).borderBottomWidth).toBe('1px');
	});

	it.each(['soft', 'ink', 'black'] as const)(
		'keeps a divided header row below the close button and spaces the body from the divider at %s depth',
		async (depth) => {
			document.documentElement.dataset.depth = depth;
			render(DialogScrollTestFixture, { paragraphCount: 3, divided: true });
			await expect
				.element(page.getByRole('heading', { name: 'Scrolling dialog' }))
				.toBeVisible();
			await Promise.allSettled(
				document.getAnimations().map((animation) => animation.finished),
			);
			const header = scrollDialogPart('dialog-header');
			const rowBelowTitle = scrollDialogPart('dialog-description');
			const closeButton = scrollDialogPart('dialog-close');
			const nestedControlGap = resolvedCssLength(header, 'var(--nested-control-gap)');

			expect(rowBelowTitle.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				closeButton.getBoundingClientRect().bottom + nestedControlGap - 0.5,
			);
			expect(getComputedStyle(scrollDialogPart('dialog-body')).paddingTop).toBe(
				getComputedStyle(header).paddingBottom,
			);
		},
	);

	it('leaves the header without a border by default', async () => {
		render(DialogScrollTestFixture, { paragraphCount: 3 });
		await expect.element(page.getByRole('heading', { name: 'Scrolling dialog' })).toBeVisible();
		expect(getComputedStyle(scrollDialogPart('dialog-header')).borderBottomWidth).toBe('0px');
	});
});
