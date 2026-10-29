import '../../../../app.css';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import * as m from '$lib/paraglide/messages.js';
import type { ShareWizardStep } from '$lib/modules/sharing/types.js';
import type * as ToastModule from '$lib/components/base/toast/index.js';
import { resolvedCssLength } from '../gift/gift_action_geometry.test_fixtures.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));
vi.mock('$lib/modules/sharing/sharing.remote.js', () => ({ shareWishlist: vi.fn() }));
vi.mock('$lib/components/base/toast/index.js', async (importOriginal) => ({
	...(await importOriginal<typeof ToastModule>()),
	toastError: vi.fn(),
}));

const { toastError } = await import('$lib/components/base/toast/index.js');

const { default: ShareWizardTestHost } = await import('./ShareWizardTestHost.svelte');
const { expectPixelsNear, expectPixelsAtLeast, expectPixelsAtMost } = createPixelAssertions(expect);

afterEach(async () => {
	delete document.documentElement.dataset.depth;
	// Drops the per-test `navigator.share` stub so the prototype's own value shows again.
	delete (navigator as { share?: unknown }).share;
	vi.restoreAllMocks();
	vi.mocked(toastError).mockClear();
	await page.viewport(1280, 720);
});

function dialog(): HTMLElement {
	return document.querySelector<HTMLElement>('[role="dialog"]')!;
}

/** Renders a wizard step and waits for the dialog's open animation so geometry is unscaled. */
async function renderStep(step: ShareWizardStep) {
	const screen = await render(ShareWizardTestHost, { step });
	await Promise.all(document.getAnimations().map((animation) => animation.finished));
	return screen;
}

function stepperRow(): HTMLElement {
	return dialog().querySelector<HTMLElement>('[data-testid="share-wizard-stepper"]')!;
}

/** Stepper steps (dot + label) in order, excluding the connectors between them. */
function stepperSteps(): HTMLElement[] {
	return [...stepperRow().querySelectorAll<HTMLElement>(':scope > :has(> span)')];
}

/** Inline gap between an action and the button placed directly before it. */
function gapBeforeAction(name: string): number {
	const action = page.getByRole('button', { name }).element();
	const previous = action.previousElementSibling!;
	expect(previous.tagName).toBe('BUTTON');
	return action.getBoundingClientRect().left - previous.getBoundingClientRect().right;
}

describe('ShareWizard share methods (issue #528)', () => {
	it('links every method to its prefilled intent and offers no Messenger', async () => {
		await renderStep('share');
		const methods = [...dialog().querySelectorAll<HTMLAnchorElement>('a[data-share-platform]')];
		const methodByPlatform = Object.fromEntries(
			methods.map((method) => [method.dataset.sharePlatform, method]),
		);

		expect(methods.map((method) => method.dataset.sharePlatform)).toEqual([
			'whatsapp',
			'email',
			'telegram',
			'sms',
		]);
		expect(dialog().textContent).not.toContain('Messenger');
		expect(methodByPlatform.whatsapp!.href).toMatch(
			/^https:\/\/wa\.me\/\?text=.+%2Fw%2Fabc123$/,
		);
		expect(methodByPlatform.telegram!.href).toMatch(
			/^https:\/\/t\.me\/share\/url\?url=.+abc123/,
		);
		expect(methodByPlatform.email!.href).toMatch(/^mailto:\?subject=.+&body=.+abc123$/);
		expect(methodByPlatform.sms!.href).toMatch(/^sms:\?&body=.+abc123$/);
		expect(methodByPlatform.whatsapp!.target).toBe('_blank');
		expect(methodByPlatform.telegram!.target).toBe('_blank');
		expect(methodByPlatform.email!.target).toBe('');
		expect(methodByPlatform.sms!.target).toBe('');
	});
});

function stubNativeShare(share: Navigator['share'] | undefined) {
	Object.defineProperty(navigator, 'share', { value: share, configurable: true });
}

function nativeShareMethod(): HTMLElement | null {
	return dialog().querySelector<HTMLElement>('[data-share-platform="native"]');
}

describe('ShareWizard native share sheet (issue #551)', () => {
	it('hides the more-options method when the browser has no share sheet', async () => {
		stubNativeShare(undefined);
		await renderStep('share');

		expect(dialog().querySelectorAll('a[data-share-platform]')).toHaveLength(4);
		expect(nativeShareMethod()).toBeNull();
		expect(dialog().textContent).not.toContain(m.share_method_native());
	});

	it('offers the share sheet after the intent methods with the wishlist title and link', async () => {
		const share = vi.fn<Navigator['share']>().mockResolvedValue();
		stubNativeShare(share);
		await renderStep('share');
		const method = page.getByRole('button', { name: m.share_method_native() });

		await expect.element(method).toBeVisible();
		const methods = [...dialog().querySelectorAll<HTMLElement>('[data-share-platform]')];
		expect(methods.map((element) => element.dataset.sharePlatform)).toEqual([
			'whatsapp',
			'email',
			'telegram',
			'sms',
			'native',
		]);
		await method.click();

		expect(share).toHaveBeenCalledOnce();
		const [data] = share.mock.calls[0]!;
		expect(data!.title).toBe('Narozeniny');
		expect(data!.text).toContain('Narozeniny');
		expect(data!.url).toMatch(/\/w\/abc123$/);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('treats a dismissed share sheet as no error', async () => {
		const share = vi
			.fn<Navigator['share']>()
			.mockRejectedValue(new DOMException('Share canceled', 'AbortError'));
		stubNativeShare(share);
		await renderStep('share');

		await page.getByRole('button', { name: m.share_method_native() }).click();

		await vi.waitFor(() => expect(share).toHaveBeenCalledOnce());
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(toastError).not.toHaveBeenCalled();
	});

	it('reports a share sheet that fails to open', async () => {
		stubNativeShare(
			vi
				.fn<Navigator['share']>()
				.mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
		);
		await renderStep('share');

		await page.getByRole('button', { name: m.share_method_native() }).click();

		await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith(m.share_native_error()));
	});
});

describe('ShareWizard (issue #442)', () => {
	it('renders the message preview as a flat note with the shared badge shape', async () => {
		await renderStep('share');
		const note = page.getByText(m.share_message_label()).element().parentElement!;
		const noteStyle = getComputedStyle(note);

		expectPixelsNear(
			Number.parseFloat(noteStyle.borderTopLeftRadius),
			resolvedCssLength(note, 'var(--radius-badge)'),
		);
		expect(noteStyle.borderTopWidth).toBe('2px');
		expect(noteStyle.boxShadow).toBe('none');
		expect(noteStyle.transform).toBe('none');
	});

	it.each(['share', 'success'] as const)(
		'joins the %s step copy field with its filled copy segment',
		async (step) => {
			await renderStep(step);
			const field = dialog().querySelector<HTMLElement>('[data-slot="input-group"]')!;
			const input = field.querySelector<HTMLInputElement>('input')!;
			const copyControls = page
				.getByRole('button', { name: m.share_copy() })
				.elements()
				.filter((control) => dialog().contains(control));
			const fieldBorder = Number.parseFloat(getComputedStyle(field).borderTopWidth);
			const fieldRect = field.getBoundingClientRect();

			expect(input.readOnly).toBe(true);
			expect(input.value).toContain('/w/abc123');
			expect(copyControls).toHaveLength(1);
			const segment = copyControls[0]!;
			expect(segment.dataset.slot).toBe('input-group-segment');
			expect(field.contains(segment)).toBe(true);
			expect(getComputedStyle(segment).boxShadow).toBe('none');
			const segmentRect = segment.getBoundingClientRect();
			expectPixelsNear(segmentRect.top, fieldRect.top + fieldBorder);
			expectPixelsNear(segmentRect.bottom, fieldRect.bottom - fieldBorder);
			expectPixelsNear(segmentRect.right, fieldRect.right - fieldBorder);
		},
	);

	it.each(['share', 'success'] as const)(
		'announces a %s step copy through a status region instead of the copy button',
		async (step) => {
			vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
			await renderStep(step);
			const copy = page.getByRole('button', { name: m.share_copy() });
			const status = page.getByRole('status');

			expect(copy.element().hasAttribute('aria-live')).toBe(false);
			await expect.element(status).toHaveTextContent('');
			await copy.click();

			await expect.element(status).toHaveTextContent(m.share_copied());
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				expect.stringContaining('/w/abc123'),
			);
		},
	);

	it.each(['soft', 'black'] as const)(
		'spaces the Zrušit and Hotovo action pairs with the nested control gap at %s depth',
		async (depth) => {
			document.documentElement.dataset.depth = depth;
			const confirmStep = await renderStep('confirm');
			const nestedControlGap = resolvedCssLength(dialog(), 'var(--nested-control-gap)');
			const confirmGap = gapBeforeAction(m.share_confirm_button());
			await confirmStep.unmount();

			await renderStep('share');
			const shareGap = gapBeforeAction(m.share_step_done());

			expectPixelsAtLeast(nestedControlGap, 1);
			expectPixelsNear(confirmGap, nestedControlGap);
			expectPixelsNear(shareGap, nestedControlGap);
			if (depth === 'black') {
				expectPixelsAtMost(resolvedCssLength(dialog(), '0.5rem'), nestedControlGap - 1);
			}
		},
	);

	describe.each([
		[360, 'soft'],
		[360, 'ink'],
		[360, 'black'],
		[390, 'soft'],
		[390, 'ink'],
		[390, 'black'],
	] as const)('stepper at %ipx and %s depth', (viewportWidth, depth) => {
		it.each(['confirm', 'share', 'success'] as const)(
			'keeps every %s step fully visible beside the close button',
			async (step) => {
				document.documentElement.dataset.depth = depth;
				await page.viewport(viewportWidth, 844);
				await renderStep(step);
				await document.fonts.ready;
				const dialogRect = dialog().getBoundingClientRect();
				const closeButton = dialog().querySelector<HTMLElement>(
					'[data-slot="dialog-close"]',
				)!;
				const closeRect = closeButton.getBoundingClientRect();
				const nestedControlGap = resolvedCssLength(dialog(), 'var(--nested-control-gap)');
				const steps = stepperSteps();

				expect(steps).toHaveLength(3);
				expectPixelsAtMost(stepperRow().scrollWidth, stepperRow().clientWidth);
				for (const stepElement of steps) {
					const stepRect = stepElement.getBoundingClientRect();
					expectPixelsAtLeast(stepRect.left, dialogRect.left);
					expectPixelsAtMost(stepRect.right + nestedControlGap, closeRect.left);
				}
				expectPixelsNear(closeRect.width, 40);
				expectPixelsNear(closeRect.height, 40);
			},
		);
	});
});
