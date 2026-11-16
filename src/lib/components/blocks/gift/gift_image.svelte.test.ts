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

describe('GiftImage thumbnail following the card crop', () => {
	function solidImage(width: number, height: number): string {
		return (
			'data:image/svg+xml,' +
			encodeURIComponent(
				`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="red"/></svg>`,
			)
		);
	}

	const wideImage = solidImage(64, 32);
	const squareImage = solidImage(48, 48);

	// Only the card owns a crop, centered, at zoom 5/6.
	const cardOnlyMeta: ImageMetadata = {
		fitMode: IMAGE_FIT_MODES.coverCrop,
		cropRect: null,
		focal: { x: 50, y: 50 },
		zoom: 1,
		bgColor: '#ffffff',
		targets: {
			square: { cropRect: { x: 0, y: 0, w: 1, h: 1 }, focal: { x: 50, y: 50 }, zoom: 5 / 6 },
		},
	};

	function framing(container: HTMLElement) {
		const frame = container.querySelector<HTMLElement>('[data-testid="image-frame"]')!;
		const image = container.querySelector('img')!;
		const frameBox = frame.getBoundingClientRect();
		const imageBox = image.getBoundingClientRect();
		return {
			widthShare: imageBox.width / frameBox.width,
			heightShare: imageBox.height / frameBox.height,
			topGapShare: (imageBox.top - frameBox.top) / frameBox.height,
		};
	}

	const closeTo = (value: number) => expect.closeTo(value, 2);

	it('frames the card zoom by its contain-to-cover position at the photo’s ratio', async () => {
		const props = {
			class: 'size-24',
			imageMeta: cardOnlyMeta,
			target: 'thumb' as const,
			alt: 'Following thumbnail',
		};
		const screen = await render(GiftImage, { props: { ...props, imageUrl: wideImage } });

		// 2:1 photo: card contain 2/3 and thumbnail contain 1/2, so card zoom 5/6 (halfway from
		// contain to cover) shows the 1:1 thumbnail at 3/4: the photo spans 3/4 of the frame's
		// height and 3/2 of its width, centered with fill above and below.
		await expect
			.poll(() => framing(screen.container))
			.toEqual({
				widthShare: closeTo(1.5),
				heightShare: closeTo(0.75),
				topGapShare: closeTo(0.125),
			});

		// A square photo: thumbnail contain equals cover, so the same card zoom fills it exactly.
		await screen.rerender({ ...props, imageUrl: squareImage });
		await expect
			.poll(() => framing(screen.container))
			.toEqual({ widthShare: closeTo(1), heightShare: closeTo(1), topGapShare: closeTo(0) });
	});
});
