import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import { DRAFT_GRID_CONTEXT, type DraftGridChange } from './gift_draft_grid_model.js';

vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { default: GiftDraftGrid } = await import('./GiftDraftGrid.svelte');

function draft(name: string, quantity = 1) {
	return {
		name,
		description: null,
		links: [],
		price: null,
		currency: 'CZK' as const,
		imageUrl: null,
		quantity,
		priority: 'medium' as const,
	};
}

function latestChange(onchange: ReturnType<typeof vi.fn>): DraftGridChange {
	return onchange.mock.calls.at(-1)?.[0] as DraftGridChange;
}

describe('GiftDraftGrid numeric inputs', () => {
	it('wires batch quantities as constrained integer inputs', async () => {
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha')],
		});

		const quantity = screen.getByRole('spinbutton', { name: m.draft_grid_col_quantity() });
		await expect.element(quantity).toHaveAttribute('min', '1');
		await expect.element(quantity).toHaveAttribute('step', '1');
		await expect.element(quantity).toHaveAttribute('type', 'number');
	});
});

describe('GiftDraftGrid row motion', () => {
	it('adds a stable-identity row at its final position and expands it in place over 520 ms', async () => {
		const onchange = vi.fn();
		const animations: Array<{
			element: HTMLElement;
			keyframes: Keyframe[];
			options: KeyframeAnimationOptions;
		}> = [];
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
			this: HTMLElement,
			keyframes,
			options,
		) {
			animations.push({
				element: this as HTMLElement,
				keyframes: keyframes as Keyframe[],
				options: options as KeyframeAnimationOptions,
			});
			return {
				cancel: vi.fn(),
				finished: Promise.resolve(),
				addEventListener: vi.fn(),
			} as unknown as Animation;
		});
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek')],
			onchange,
		});

		const before = screen.container.querySelectorAll<HTMLElement>('[data-gift-item]');
		expect(before).toHaveLength(2);
		expect([...before].every((row) => Boolean(row.dataset.giftId))).toBe(true);

		await screen.getByRole('button', { name: m.draft_grid_add_row() }).click();
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(3),
		);

		const inserted = screen.container.querySelectorAll<HTMLElement>('[data-gift-item]')[2];
		const insertion = animations.find(({ element }) => element === inserted);
		expect(insertion).toMatchObject({
			keyframes: [
				{ height: '0px', opacity: 0, overflow: 'clip' },
				{ height: expect.any(String), opacity: 1, overflow: 'clip' },
			],
			options: {
				duration: 520,
				easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
			},
		});
		expect(insertion?.keyframes.some((frame) => 'transform' in frame)).toBe(false);
		expect(latestChange(onchange).selectedCount).toBe(3);
		animate.mockRestore();
	});

	it('keeps a removed row local for 440 ms before stable siblings settle over 520 ms', async () => {
		const onchange = vi.fn();
		let finishRemoval!: () => void;
		const removalFinished = new Promise<void>((resolve) => (finishRemoval = resolve));
		const animations: Array<{
			element: HTMLElement;
			keyframes: Keyframe[];
			options: KeyframeAnimationOptions;
		}> = [];
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
			this: HTMLElement,
			keyframes,
			options,
		) {
			const typedOptions = options as KeyframeAnimationOptions;
			animations.push({
				element: this as HTMLElement,
				keyframes: keyframes as Keyframe[],
				options: typedOptions,
			});
			return {
				cancel: vi.fn(),
				finished: typedOptions.duration === 440 ? removalFinished : Promise.resolve(),
				addEventListener: vi.fn(),
			} as unknown as Animation;
		});
		const rectangles = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				const rows = [...(this.parentElement?.querySelectorAll('[data-gift-item]') ?? [])];
				const top = Math.max(0, rows.indexOf(this)) * 100 + 10;
				return {
					left: 10,
					top,
					right: 110,
					bottom: top + 80,
					width: 100,
					height: 80,
					x: 10,
					y: top,
					toJSON: () => ({}),
				};
			});
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek')],
			onchange,
		});
		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		const survivor = screen.container.querySelectorAll<HTMLElement>('[data-gift-item]')[1];

		await screen.getByRole('button', { name: m.draft_grid_remove_row() }).first().click();
		await vi.waitFor(() => expect(latestChange(onchange).selectedCount).toBe(1));
		expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(2);
		expect(animations.filter(({ options }) => options.duration === 440)).toHaveLength(1);

		finishRemoval();
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(1),
		);
		expect(
			animations.some(
				({ element, keyframes, options }) =>
					element === survivor &&
					options.duration === 520 &&
					keyframes.some((frame) => 'transform' in frame),
			),
		).toBe(true);
		animate.mockRestore();
		rectangles.mockRestore();
	});

	it('preserves survivor geometry during exit and applies one post-removal inverse transform', async () => {
		let finishRemoval!: () => void;
		const removalFinished = new Promise<void>((resolve) => (finishRemoval = resolve));
		const animations: Array<{
			element: HTMLElement;
			keyframes: Keyframe[];
			options: KeyframeAnimationOptions;
		}> = [];
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
			this: HTMLElement,
			keyframes,
			options,
		) {
			const typedOptions = options as KeyframeAnimationOptions;
			animations.push({
				element: this,
				keyframes: keyframes as Keyframe[],
				options: typedOptions,
			});
			return {
				cancel: vi.fn(),
				finished: typedOptions.duration === 440 ? removalFinished : Promise.resolve(),
				addEventListener: vi.fn(),
			} as unknown as Animation;
		});
		const rectangles = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				const rows = [...(this.parentElement?.querySelectorAll('[data-gift-item]') ?? [])];
				const top = Math.max(0, rows.indexOf(this)) * 100 + 10;
				return {
					left: 10,
					top,
					right: 110,
					bottom: top + 80,
					width: 100,
					height: 80,
					x: 10,
					y: top,
					toJSON: () => ({}),
				};
			});
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek'), draft('Čaj')],
		});
		const initialRows = screen.container.querySelectorAll<HTMLElement>('[data-gift-item]');
		const removed = initialRows[0];
		const survivor = initialRows[1];
		const survivorTopBefore = survivor.getBoundingClientRect().top;

		await screen.getByRole('button', { name: m.draft_grid_remove_row() }).first().click();
		await vi.waitFor(() =>
			expect(animations.filter(({ options }) => options.duration === 440)).toHaveLength(1),
		);

		const exit = animations.find(({ options }) => options.duration === 440);
		expect(survivor.getBoundingClientRect().top).toBe(survivorTopBefore);
		expect(exit?.element).toBe(removed);
		expect(exit?.keyframes).toEqual([
			{
				clipPath: 'inset(0 0 0 0)',
				opacity: 1,
				transform: 'scaleY(1)',
				transformOrigin: 'top',
			},
			{
				clipPath: 'inset(50% 0 50% 0)',
				opacity: 0,
				transform: 'scaleY(0)',
				transformOrigin: 'top',
			},
		]);
		expect(exit?.keyframes.some((frame) => 'height' in frame)).toBe(false);
		expect(animations.some(({ element }) => element === survivor)).toBe(false);

		finishRemoval();
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(2),
		);
		await vi.waitFor(() =>
			expect(
				animations.filter(
					({ element, options }) => element === survivor && options.duration === 520,
				),
			).toHaveLength(1),
		);
		const settlement = animations.find(
			({ element, options }) => element === survivor && options.duration === 520,
		);
		expect(settlement?.keyframes).toEqual([
			{ transform: 'translate(0px, 100px)' },
			{ transform: 'translate(0, 0)' },
		]);
		expect(
			animations.some(
				({ element, options }) => element === removed && options.duration === 520,
			),
		).toBe(false);
		animate.mockRestore();
		rectangles.mockRestore();
	});

	it('bulk-deletes multiple stable IDs in one authoritative animation run', async () => {
		const onchange = vi.fn();
		let finish!: () => void;
		const finished = new Promise<void>((resolve) => (finish = resolve));
		const removedIds: string[] = [];
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (
			this: HTMLElement,
			_keyframes,
			options,
		) {
			if ((options as KeyframeAnimationOptions).duration === 440) {
				removedIds.push((this as HTMLElement).dataset.giftId ?? '');
			}
			return {
				cancel: vi.fn(),
				finished:
					(options as KeyframeAnimationOptions).duration === 440
						? finished
						: Promise.resolve(),
				addEventListener: vi.fn(),
			} as unknown as Animation;
		});
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek'), draft('Čaj')],
			onchange,
		});
		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());

		await screen.getByRole('button', { name: m.draft_grid_bulk_delete() }).click();
		await vi.waitFor(() => expect(latestChange(onchange).selectedCount).toBe(0));
		await vi.waitFor(() => expect(removedIds).toHaveLength(3));
		expect(new Set(removedIds).size).toBe(3);
		expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(3);

		finish();
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(0),
		);
		expect(removedIds).toHaveLength(3);
		animate.mockRestore();
	});

	it('bounds bulk exits and performs no per-row DOM searches for a large selection', async () => {
		const onchange = vi.fn();
		const initialRows = Array.from({ length: 80 }, (_, index) => draft(`Dárek ${index}`));
		const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(
			() =>
				({
					cancel: vi.fn(),
					finished: Promise.resolve(),
					addEventListener: vi.fn(),
				}) as unknown as Animation,
		);
		const screen = await render(GiftDraftGrid, { initialRows, onchange });
		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		const rowsElement =
			screen.container.querySelector<HTMLElement>('[data-gift-item]')?.parentElement;
		expect(rowsElement).not.toBeNull();
		const nativeQuery = rowsElement!.querySelectorAll.bind(rowsElement);
		let giftQueries = 0;
		const query = vi
			.spyOn(rowsElement!, 'querySelectorAll')
			.mockImplementation((selectors: string) => {
				if (selectors === '[data-gift-item]') {
					giftQueries += 1;
				}
				return nativeQuery(selectors);
			});

		await screen.getByRole('button', { name: m.draft_grid_bulk_delete() }).click();
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(0),
		);

		const exits = animate.mock.calls.filter(
			([, options]) => (options as KeyframeAnimationOptions).duration === 440,
		);
		expect(exits.length).toBeLessThanOrEqual(16);
		expect(giftQueries).toBeLessThanOrEqual(3);
		expect(latestChange(onchange).selectedCount).toBe(0);
		query.mockRestore();
		animate.mockRestore();
	});

	it('cancels a stale removal when a rapid add makes the latest rows authoritative', async () => {
		const onchange = vi.fn();
		const removal = {
			cancel: vi.fn(),
			finished: new Promise<void>(() => {}),
			addEventListener: vi.fn(),
		} as unknown as Animation;
		const animate = vi
			.spyOn(HTMLElement.prototype, 'animate')
			.mockImplementation((_keyframes, options) =>
				(options as KeyframeAnimationOptions).duration === 440
					? removal
					: ({
							cancel: vi.fn(),
							finished: Promise.resolve(),
							addEventListener: vi.fn(),
						} as unknown as Animation),
			);
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek')],
			onchange,
		});
		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());

		await screen.getByRole('button', { name: m.draft_grid_remove_row() }).first().click();
		await vi.waitFor(() => expect(latestChange(onchange).selectedCount).toBe(1));
		await screen.getByRole('button', { name: m.draft_grid_add_row() }).click();

		await vi.waitFor(() => expect(removal.cancel).toHaveBeenCalledOnce());
		await vi.waitFor(() =>
			expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(2),
		);
		expect(latestChange(onchange).selectedCount).toBe(2);
		animate.mockRestore();
	});

	it('mutates additions and removals immediately without animation under reduced motion', async () => {
		const onchange = vi.fn();
		const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue({
			matches: true,
			media: '(prefers-reduced-motion: reduce)',
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		});
		const animate = vi.spyOn(HTMLElement.prototype, 'animate');
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha')],
			onchange,
		});
		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());

		await screen.getByRole('button', { name: m.draft_grid_remove_row() }).first().click();
		expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(0);
		expect(latestChange(onchange).selectedCount).toBe(0);

		await screen.getByRole('button', { name: m.draft_grid_add_row() }).click();
		expect(screen.container.querySelectorAll('[data-gift-item]')).toHaveLength(1);
		expect(latestChange(onchange).selectedCount).toBe(1);
		expect(animate).not.toHaveBeenCalled();
		animate.mockRestore();
		matchMedia.mockRestore();
	});
});

describe('GiftDraftGrid submission gate', () => {
	it('blocks a mixed selected batch until the invalid row is corrected', async () => {
		const onchange = vi.fn();
		const screen = await render(GiftDraftGrid, {
			initialRows: [draft('Kniha'), draft('Hrnek', 0)],
			onchange,
		});

		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		expect(latestChange(onchange)).toMatchObject({
			validCount: 1,
			selectedCount: 2,
			blockingCount: 1,
		});

		await screen
			.getByRole('spinbutton', { name: m.draft_grid_col_quantity() })
			.nth(1)
			.fill('2');
		await vi.waitFor(() => expect(latestChange(onchange).blockingCount).toBe(0));
		expect(latestChange(onchange)).toMatchObject({
			validCount: 2,
			selectedCount: 2,
			blockingCount: 0,
		});
	});

	it('blocks an unresolved duplicate until its badge is dismissed', async () => {
		const onchange = vi.fn();
		const duplicateDraft = {
			...draft('Stejný hrnek'),
			links: [{ url: 'https://example.com/hrnek?new=1' }],
		};
		const screen = await render(GiftDraftGrid, {
			props: {
				context: DRAFT_GRID_CONTEXT.import,
				initialRows: [duplicateDraft],
				existingGifts: [
					{ name: 'Stejný hrnek', links: [{ url: 'https://example.com/hrnek?old=1' }] },
				],
				onchange,
			},
		});

		await vi.waitFor(() => expect(onchange).toHaveBeenCalled());
		expect(latestChange(onchange)).toMatchObject({ validCount: 0, blockingCount: 1 });

		await screen.getByRole('button', { name: m.draft_grid_duplicate_badge() }).click();
		await vi.waitFor(() => expect(latestChange(onchange).blockingCount).toBe(0));
		expect(latestChange(onchange)).toMatchObject({ validCount: 1, blockingCount: 0 });
	});
});
