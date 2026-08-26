import '../../../../app.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import {
	IMAGE_FIT_MODES,
	type GiftCropTarget,
	type ImageMetadata,
} from '$lib/modules/images/index.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftImage } = await import('./GiftImage.svelte');

const imageUrl =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>');

function imageMeta(bgColor: string | null): ImageMetadata {
	return {
		fitMode: IMAGE_FIT_MODES.containPadded,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor,
	};
}

const targets = ['square', 'thumb'] as const satisfies readonly GiftCropTarget[];
const expectedComputedBackground = {
	'#ffffff': 'rgb(255, 255, 255)',
	'#000000': 'rgb(0, 0, 0)',
} as const;

describe('GiftImage persisted background fill', () => {
	it.each(
		targets.flatMap(
			(target) =>
				[
					[target, '#ffffff'],
					[target, '#000000'],
				] as const,
		),
	)('renders the %s target with %s', async (target, bgColor) => {
		const screen = await render(GiftImage, {
			props: {
				imageUrl,
				imageMeta: imageMeta(bgColor),
				target,
				alt: `Gift ${target}`,
			},
		});

		await expect.element(screen.getByRole('img', { name: `Gift ${target}` })).toBeVisible();
		const frame = screen.container.querySelector<HTMLElement>('[style*="--frame-fill"]');
		expect(frame).not.toBeNull();
		expect(getComputedStyle(frame!).getPropertyValue('--frame-fill').trim()).toBe(bgColor);
		expect(getComputedStyle(frame!).backgroundColor).toBe(expectedComputedBackground[bgColor]);
	});

	it('lets an explicit fill win over caller background classes', async () => {
		const screen = await render(GiftImage, {
			props: {
				class: 'size-12 bg-transparent',
				imageUrl,
				imageMeta: imageMeta('#000000'),
				target: 'thumb',
				alt: 'Gift override',
			},
		});

		await expect.element(screen.getByRole('img', { name: 'Gift override' })).toBeVisible();
		const frame = screen.container.querySelector<HTMLElement>('[style*="--frame-fill"]');
		expect(frame).not.toBeNull();
		expect(getComputedStyle(frame!).backgroundColor).toBe('rgb(0, 0, 0)');
	});

	it.each(
		targets.flatMap(
			(target) =>
				[
					[target, null],
					[target, 'transparent'],
				] as const,
		),
	)('keeps the theme fallback for the %s target with %s metadata', async (target, bgColor) => {
		const root = document.documentElement;
		const previousValue = root.style.getPropertyValue('--secondary');
		const previousPriority = root.style.getPropertyPriority('--secondary');
		root.style.setProperty('--secondary', 'rgb(12, 34, 56)');

		try {
			const screen = await render(GiftImage, {
				props: {
					imageUrl,
					imageMeta: imageMeta(bgColor),
					target,
					alt: `Gift ${target}`,
				},
			});

			await expect.element(screen.getByRole('img', { name: `Gift ${target}` })).toBeVisible();
			const frame = screen.container.querySelector<HTMLElement>('[style*="--frame-fill"]');
			expect(frame).not.toBeNull();
			expect(getComputedStyle(frame!).getPropertyValue('--frame-fill').trim()).toBe(
				'rgb(12, 34, 56)',
			);
			expect(getComputedStyle(frame!).backgroundColor).toBe('rgb(12, 34, 56)');
		} finally {
			if (previousValue) {
				root.style.setProperty('--secondary', previousValue, previousPriority);
			} else {
				root.style.removeProperty('--secondary');
			}
		}
	});
});
