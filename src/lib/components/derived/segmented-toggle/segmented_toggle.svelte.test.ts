import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import {
	isFacePaintHidden,
	isIndicatorOnFace,
	isSlideRunning,
	nextFrames,
	recordSlides,
	resolveCssValue,
	selectionIndicatorOf,
} from '../../../../../tests/helpers/selection-slide-assertions.mjs';
import SegmentedToggleTestFixture from './SegmentedToggleTestFixture.svelte';
import { SEGMENTED_TOGGLE_PRESENTATIONS, type SegmentedTogglePresentation } from './index.js';

const { expectPixelsNear } = createPixelAssertions(expect);

async function renderToggle(presentation: SegmentedTogglePresentation) {
	const screen = await render(SegmentedToggleTestFixture, { presentation });
	const radios = screen
		.getByRole('radio')
		.all()
		.map((radio) => radio.element() as HTMLElement);
	const group = radios[0].parentElement!;
	const faceOf = (radio: HTMLElement) =>
		presentation === 'connected'
			? radio.querySelector<HTMLElement>('.elevation-surface')!
			: radio;
	await nextFrames();
	return { screen, group, radios, faceOf };
}

function expectShippedSelectedFacePaint(
	presentation: SegmentedTogglePresentation,
	group: HTMLElement,
	selectedItem: HTMLElement,
) {
	const context = group.parentElement!;
	const indicatorStyle = getComputedStyle(selectionIndicatorOf(group));
	const ink = resolveCssValue(context, 'color', 'var(--ink)');

	expect(indicatorStyle.backgroundColor).toBe(
		resolveCssValue(context, 'background-color', 'var(--card)'),
	);
	expect(indicatorStyle.borderTopLeftRadius).toBe(
		getComputedStyle(selectedItem).borderTopLeftRadius,
	);
	if (presentation === 'default') {
		expect(indicatorStyle.outlineStyle).toBe('solid');
		expect(indicatorStyle.outlineWidth).toBe('2px');
		expect(indicatorStyle.outlineOffset).toBe('-2px');
		expect(indicatorStyle.outlineColor).toBe(ink);
	} else {
		expectPixelsNear(
			parseFloat(indicatorStyle.borderTopWidth),
			parseFloat(getComputedStyle(group).getPropertyValue('--border-w')),
		);
		expect(indicatorStyle.borderTopStyle).toBe('solid');
		expect(indicatorStyle.borderTopColor).toBe(ink);
	}
}

describe.each(SEGMENTED_TOGGLE_PRESENTATIONS)(
	'SegmentedToggle selected face slide (%s)',
	(presentation) => {
		it('places the shipped selected face on the initial selection without animating', async () => {
			const { screen, group, radios, faceOf } = await renderToggle(presentation);

			expect(isIndicatorOnFace(group, faceOf(radios[0]))).toBe(true);
			expect(isSlideRunning(selectionIndicatorOf(group))).toBe(false);
			expectShippedSelectedFacePaint(presentation, group, radios[0]);
			expect(isFacePaintHidden(faceOf(radios[0]))).toBe(true);
			await screen.unmount();
		});

		it('slides with the shared motion tokens', async () => {
			const { screen, group } = await renderToggle(presentation);
			const indicatorStyle = getComputedStyle(selectionIndicatorOf(group));

			// Font loading may reposition instantly first, pausing transitions until the next frame.
			await expect
				.poll(() => indicatorStyle.transitionDuration)
				.toBe(resolveCssValue(group, 'transition-duration', 'var(--duration-normal)'));
			expect(indicatorStyle.transitionTimingFunction).toBe(
				resolveCssValue(group, 'transition-timing-function', 'var(--ease-standard)'),
			);
			await screen.unmount();
		});

		it('slides the selected face to a clicked option', async () => {
			const { screen, group, radios, faceOf } = await renderToggle(presentation);
			const slides = recordSlides(selectionIndicatorOf(group));

			await userEvent.click(radios[1]);

			await expect.element(radios[1]).toHaveAttribute('aria-checked', 'true');
			await expect.poll(() => isIndicatorOnFace(group, faceOf(radios[1]))).toBe(true);
			expect(slides.hasSlid()).toBe(true);
			expect(isFacePaintHidden(faceOf(radios[1]))).toBe(true);
			slides.stop();
			await screen.unmount();
		});

		it('slides the selected face with keyboard selection', async () => {
			const { screen, group, radios, faceOf } = await renderToggle(presentation);
			const slides = recordSlides(selectionIndicatorOf(group));

			radios[0].focus();
			await userEvent.keyboard('{ArrowRight}');
			await userEvent.keyboard(' ');

			await expect.element(radios[1]).toHaveAttribute('aria-checked', 'true');
			await expect.poll(() => isIndicatorOnFace(group, faceOf(radios[1]))).toBe(true);
			expect(slides.hasSlid()).toBe(true);
			slides.stop();
			await screen.unmount();
		});

		it('slides the selected face when the bound value changes programmatically', async () => {
			const { screen, group, radios, faceOf } = await renderToggle(presentation);
			const slides = recordSlides(selectionIndicatorOf(group));

			await screen.getByRole('button', { name: 'Select third programmatically' }).click();

			await expect.element(radios[2]).toHaveAttribute('aria-checked', 'true');
			await expect.poll(() => isIndicatorOnFace(group, faceOf(radios[2]))).toBe(true);
			expect(slides.hasSlid()).toBe(true);
			slides.stop();
			await screen.unmount();
		});

		it('repositions the selected face without animating when an option resizes', async () => {
			const { screen, group, radios, faceOf } = await renderToggle(presentation);

			radios[0].style.paddingInline = '40px';
			await nextFrames();

			expect(isSlideRunning(selectionIndicatorOf(group))).toBe(false);
			expect(isIndicatorOnFace(group, faceOf(radios[0]))).toBe(true);
			await screen.unmount();
		});

		it('keeps the selected face in place without animating when the depth changes', async () => {
			const root = document.documentElement;
			const previousDepth = root.dataset.depth;
			const { screen, group, radios, faceOf } = await renderToggle(presentation);
			const slides = recordSlides(selectionIndicatorOf(group));

			try {
				for (const depth of ['soft', 'ink', 'black']) {
					root.dataset.depth = depth;
					await nextFrames();

					expect(isSlideRunning(selectionIndicatorOf(group))).toBe(false);
					expect(isIndicatorOnFace(group, faceOf(radios[0]))).toBe(true);
				}
				expect(slides.hasSlid()).toBe(false);
			} finally {
				slides.stop();
				if (previousDepth === undefined) {
					delete root.dataset.depth;
				} else {
					root.dataset.depth = previousDepth;
				}
				await screen.unmount();
			}
		});
	},
);

describe('SegmentedToggle default presentation focus', () => {
	it('shows only the focus ring on a keyboard-focused selected item', async () => {
		const { screen, group, radios } = await renderToggle('default');

		radios[1].focus();
		await userEvent.keyboard('{ArrowLeft}');

		await expect.element(radios[0]).toHaveFocus();
		const itemStyle = getComputedStyle(radios[0]);
		expect(itemStyle.outlineColor).toBe(resolveCssValue(group, 'color', 'var(--ring)'));
		expect(itemStyle.outlineOffset).toBe('2px');
		expect(getComputedStyle(selectionIndicatorOf(group)).outlineColor).toBe('rgba(0, 0, 0, 0)');
		await screen.unmount();
	});
});

describe('SegmentedToggle tray', () => {
	it('hugs its options inside a stretching column parent', async () => {
		const { screen, group, radios } = await renderToggle('default');
		const groupStyle = getComputedStyle(group);
		const optionsWidth =
			radios.reduce((total, radio) => total + radio.getBoundingClientRect().width, 0) +
			parseFloat(groupStyle.columnGap) * (radios.length - 1) +
			parseFloat(groupStyle.paddingLeft) +
			parseFloat(groupStyle.paddingRight);

		expect(group.parentElement!.getBoundingClientRect().width).toBe(400);
		expectPixelsNear(group.getBoundingClientRect().width, optionsWidth);
		await screen.unmount();
	});

	it('keeps default options static on hover', async () => {
		const { screen, radios } = await renderToggle('default');
		const option = radios[1];
		const surface = option.querySelector<HTMLElement>('.elevation-surface')!;

		await userEvent.hover(option);
		for (const element of [option, surface]) {
			const style = getComputedStyle(element);
			expect(style.translate).toBe('none');
			expect(style.scale).toBe('none');
			expect(style.transform).toBe('none');
		}
		await screen.unmount();
	});
});
