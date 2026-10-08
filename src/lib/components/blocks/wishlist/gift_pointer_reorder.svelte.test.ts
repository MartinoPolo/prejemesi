import '../../../../app.css';
import { describe, expect, it } from 'vitest';
import { createPixelAssertions } from '../../../../../tests/helpers/pixel-assertions.mjs';
import type { GiftReorderPlacement } from '$lib/modules/gifts/gift_grouped_reorder.js';
import {
	createGiftPointerReorderController,
	GIFT_REORDER_GROUP_ATTRIBUTE,
} from './gift_pointer_reorder.svelte.js';

const { expectPixelsNear } = createPixelAssertions(expect);

describe('gift pointer reorder controller (#239)', () => {
	function createItems() {
		return ['a', 'b', 'c'].map((id, index) => {
			const element = document.createElement('div');
			element.dataset.giftId = id;
			element.textContent = id;
			Object.defineProperty(element, 'getBoundingClientRect', {
				value: () => ({
					x: index * 100,
					y: 20,
					left: index * 100,
					top: 20,
					right: index * 100 + 80,
					bottom: 80,
					width: 80,
					height: 60,
					toJSON: () => {},
				}),
			});
			document.body.append(element);
			return element;
		});
	}

	function pointer(type: string, pointerId: number, clientX: number, clientY: number) {
		return new PointerEvent(type, {
			pointerId,
			pointerType: 'pen',
			button: 0,
			clientX,
			clientY,
			bubbles: true,
			cancelable: true,
		});
	}

	it('keeps an exact-size overlay and commits every live previewed id', () => {
		const items = createItems();
		const previews: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: (ids) => previews.push(ids),
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 7, 20, 40), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]');
		expect(overlay?.style.width).toBe('80px');
		expect(overlay?.style.height).toBe('60px');
		expect(overlay?.textContent).toBe('a');
		expect(items[0]!.style.visibility).toBe('hidden');

		window.dispatchEvent(pointer('pointermove', 7, 240, 40));
		expect(previews).toEqual([['b', 'c', 'a']]);
		window.dispatchEvent(pointer('pointerup', 7, 240, 40));
		expect(commits).toEqual([['b', 'c', 'a']]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		expect(items[0]!.style.visibility).toBe('');
		items.forEach((item) => item.remove());
	});

	it.each(['pointerup', 'pointercancel'])(
		'hands the visible pointer position to collection settling on %s',
		(finishEvent) => {
			const items = createItems();
			const settlements: unknown[] = [];
			const controller = createGiftPointerReorderController({
				getItemElements: () => items,
				getItemIds: () => ['a', 'b', 'c'],
				onPreviewOrder: () => {},
				onCommitOrder: () => {},
				onCancelOrder: () => {},
			});
			items[0]!.addEventListener('gift-motion-drop', (event) => {
				if (event instanceof CustomEvent) {
					settlements.push(event.detail);
				}
			});
			try {
				controller.start(pointer('pointerdown', 7, 20, 40), 0);
				expect(items[0]!.hasAttribute('data-gift-motion-dragging')).toBe(true);
				window.dispatchEvent(pointer('pointermove', 7, 240, 90));
				window.dispatchEvent(pointer(finishEvent, 7, 240, 90));
				expect(settlements).toEqual([
					{
						giftId: 'a',
						rectangle: expect.objectContaining({
							left: 220,
							top: 70,
							width: 80,
							height: 60,
						}),
					},
				]);
				expect(items[0]!.hasAttribute('data-gift-motion-dragging')).toBe(false);
			} finally {
				controller.destroy();
				items.forEach((item) => item.remove());
			}
		},
	);

	it('retains inherited wishlist theme properties and card layout in the body overlay', () => {
		const theme = document.createElement('div');
		theme.style.setProperty('--wishlist-surface', 'rgb(96, 24, 48)');
		theme.style.setProperty('--frame-fill', 'rgb(244, 220, 228)');
		const item = document.createElement('div');
		item.dataset.giftId = 'themed';
		item.style.display = 'grid';
		item.style.gridTemplateRows = '40px 80px';
		item.innerHTML =
			'<div data-image style="background: var(--frame-fill)">Image</div><div data-body style="background: var(--wishlist-surface)"><span>Badge</span><button>Action</button></div>';
		Object.defineProperty(item, 'getBoundingClientRect', {
			value: () => ({
				x: 12,
				y: 20,
				left: 12,
				top: 20,
				right: 212,
				bottom: 140,
				width: 200,
				height: 120,
				toJSON: () => {},
			}),
		});
		theme.append(item);
		document.body.append(theme);
		const controller = createGiftPointerReorderController({
			getItemElements: () => [item],
			getItemIds: () => ['themed'],
			onPreviewOrder: () => {},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 13, 30, 40), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]')!;
		const image = overlay.querySelector<HTMLElement>('[data-image]')!;
		const body = overlay.querySelector<HTMLElement>('[data-body]')!;

		expect(overlay.parentElement).toBe(document.body);
		expect(overlay.style.width).toBe('200px');
		expect(overlay.style.height).toBe('120px');
		expect(overlay.style.getPropertyValue('--wishlist-surface')).toBe('rgb(96, 24, 48)');
		expect(overlay.style.getPropertyValue('--frame-fill')).toBe('rgb(244, 220, 228)');
		expect(getComputedStyle(body).backgroundColor).toBe('rgb(96, 24, 48)');
		expect(getComputedStyle(image).backgroundColor).toBe('rgb(244, 220, 228)');
		expect(Array.from(overlay.children).map((child) => child.textContent)).toEqual([
			'Image',
			'BadgeAction',
		]);
		expect(body.querySelector('span')?.textContent).toBe('Badge');
		expect(body.querySelector('button')?.textContent).toBe('Action');

		controller.destroy();
		theme.remove();
	});

	it('preserves every subgrid row when the card overlay leaves its grid parent', () => {
		const grid = document.createElement('div');
		grid.style.display = 'grid';
		grid.style.gridTemplateRows = '80px 24px 20px 18px 16px 14px 42px';
		grid.style.rowGap = '20px';
		const item = document.createElement('div');
		item.dataset.giftId = 'subgrid-card';
		item.style.display = 'grid';
		item.style.gridRow = 'span 7';
		item.style.gridTemplateRows = 'subgrid';
		item.style.rowGap = '0';
		item.innerHTML = `
			<div style="display: grid; grid-row: span 7; grid-template-rows: subgrid">
				<div data-layout-part style="grid-row: 1">Image</div>
				<div data-layout-part style="display: grid; grid-row: 2 / span 5; grid-template-rows: subgrid">
					<span data-layout-part style="grid-row: 1">Name</span>
					<a data-layout-part style="grid-row: 4">Link</a>
				</div>
				<button data-layout-part style="grid-row: 7">Action</button>
			</div>`;
		grid.append(item);
		document.body.append(grid);
		const controller = createGiftPointerReorderController({
			getItemElements: () => [item],
			getItemIds: () => ['subgrid-card'],
			onPreviewOrder: () => {},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});
		const sourceRect = item.getBoundingClientRect();
		const relativeLayout = (root: HTMLElement) => {
			const rootRect = root.getBoundingClientRect();
			return Array.from(root.querySelectorAll<HTMLElement>('[data-layout-part]')).map(
				(element) => {
					const rect = element.getBoundingClientRect();
					return { top: rect.top - rootRect.top, height: rect.height };
				},
			);
		};
		const sourceLayout = relativeLayout(item);

		controller.start(pointer('pointerdown', 13, sourceRect.left + 10, sourceRect.top + 10), 0);
		const overlay = document.querySelector<HTMLElement>('[data-gift-reorder-overlay]')!;

		try {
			const overlayLayout = relativeLayout(overlay);
			expect(overlayLayout).toHaveLength(sourceLayout.length);
			for (const [index, overlayPart] of overlayLayout.entries()) {
				expectPixelsNear(overlayPart.top, sourceLayout[index]!.top);
				expectPixelsNear(overlayPart.height, sourceLayout[index]!.height);
			}
			expect(getComputedStyle(overlay).gridTemplateRows).not.toContain('subgrid');
		} finally {
			controller.destroy();
			grid.remove();
		}
	});

	it('keeps stationary boundary hit testing anchored when preview layout shifts under it', () => {
		let renderedIds = ['a', 'b', 'c'];
		let shiftedByPreview = false;
		const elementsById = new Map(
			renderedIds.map((id) => {
				const element = document.createElement('div');
				element.dataset.giftId = id;
				element.textContent = id;
				Object.defineProperty(element, 'getBoundingClientRect', {
					value: () => {
						const leftById = shiftedByPreview
							? { a: 300, b: 0, c: 200 }
							: { a: 0, b: 100, c: 200 };
						const left = leftById[id as keyof typeof leftById];

						return {
							x: left,
							y: 20,
							left,
							top: 20,
							right: left + 80,
							bottom: 80,
							width: 80,
							height: 60,
							toJSON: () => {},
						};
					},
				});
				document.body.append(element);
				return [id, element] as const;
			}),
		);
		const previews: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => renderedIds.map((id) => elementsById.get(id)!),
			getItemIds: () => [...renderedIds],
			onPreviewOrder: (ids) => {
				previews.push(ids);
				renderedIds = [...ids];
				shiftedByPreview = true;
			},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
		});

		controller.start(pointer('pointerdown', 11, 20, 40), 0);
		window.dispatchEvent(pointer('pointermove', 11, 240, 40));
		window.dispatchEvent(pointer('pointermove', 11, 240, 40));

		expect(previews).toEqual([['b', 'c', 'a']]);
		controller.destroy();
		elementsById.forEach((element) => element.remove());
	});

	it.each([
		['pointercancel', () => window.dispatchEvent(pointer('pointercancel', 9, 240, 40))],
		['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
	])('restores the pre-drag order on %s without committing', (_name, cancelDrag) => {
		const items = createItems();
		const cancellations: string[][] = [];
		const commits: string[][] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => items,
			getItemIds: () => ['a', 'b', 'c'],
			onPreviewOrder: () => {},
			onCommitOrder: (ids) => commits.push(ids),
			onCancelOrder: (ids) => cancellations.push(ids),
		});

		controller.start(pointer('pointerdown', 9, 120, 40), 1);
		window.dispatchEvent(pointer('pointermove', 9, 240, 40));
		cancelDrag();
		expect(cancellations).toEqual([['a', 'b', 'c']]);
		expect(commits).toEqual([]);
		expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		controller.destroy();
		items.forEach((item) => item.remove());
	});
});

describe('grouped gift pointer reorder (#454)', () => {
	const HIGH = 'priority:high';
	const LOW = 'priority:low';
	const NONE = 'priority:none';

	interface LayoutEntry {
		groupKey: string;
		top: number;
		height: number;
		giftId?: string;
	}

	/** Header and item rows stacked in one column; the empty "none" group shows only a drop zone. */
	const LAYOUT: LayoutEntry[] = [
		{ groupKey: HIGH, top: 0, height: 20 },
		{ groupKey: HIGH, top: 20, height: 60, giftId: 'a' },
		{ groupKey: HIGH, top: 80, height: 60, giftId: 'b' },
		{ groupKey: LOW, top: 160, height: 20 },
		{ groupKey: LOW, top: 180, height: 60, giftId: 'c' },
		{ groupKey: NONE, top: 260, height: 20 },
		{ groupKey: NONE, top: 280, height: 40 },
	];

	function pointer(type: string, clientX: number, clientY: number) {
		return new PointerEvent(type, {
			pointerId: 11,
			pointerType: 'mouse',
			button: 0,
			clientX,
			clientY,
			bubbles: true,
			cancelable: true,
		});
	}

	function renderGroups() {
		const container = document.createElement('div');
		Object.assign(container.style, {
			position: 'fixed',
			left: '0',
			top: '0',
			width: '300px',
			height: '320px',
		});
		const elements = LAYOUT.map((entry) => {
			const element = document.createElement('div');
			element.setAttribute(GIFT_REORDER_GROUP_ATTRIBUTE, entry.groupKey);
			if (entry.giftId !== undefined) {
				element.setAttribute('data-gift-item', '');
				element.dataset.giftId = entry.giftId;
				element.textContent = entry.giftId;
			}
			Object.assign(element.style, {
				position: 'absolute',
				left: '0',
				top: `${entry.top}px`,
				width: '300px',
				height: `${entry.height}px`,
			});
			container.append(element);
			return element;
		});
		document.body.append(container);
		const items = elements.filter((element) => element.hasAttribute('data-gift-item'));
		return { container, elements, items };
	}

	function createGroupedController(
		rendered: ReturnType<typeof renderGroups>,
		onPreview: (placement: GiftReorderPlacement) => void = () => {},
	) {
		const previews: GiftReorderPlacement[] = [];
		const commits: GiftReorderPlacement[] = [];
		const cancellations: number[] = [];
		const controller = createGiftPointerReorderController({
			getItemElements: () => rendered.items,
			getItemIds: () => rendered.items.map((item) => item.dataset.giftId!),
			onPreviewOrder: () => {},
			onCommitOrder: () => {},
			onCancelOrder: () => {},
			getGroupTargetElements: () => rendered.elements,
			grouped: {
				isActive: () => true,
				onPreviewPlacement: (placement) => {
					previews.push(placement);
					onPreview(placement);
				},
				onCommitPlacement: (placement) => commits.push(placement),
				onCancelPlacement: () => cancellations.push(1),
			},
		});
		return { controller, previews, commits, cancellations };
	}

	it('moves within a group, into another group and into an empty group, then commits one placement', () => {
		const rendered = renderGroups();
		const { controller, previews, commits } = createGroupedController(rendered);
		try {
			controller.start(pointer('pointerdown', 150, 50), 0);
			window.dispatchEvent(pointer('pointermove', 150, 120));
			window.dispatchEvent(pointer('pointermove', 150, 200));
			window.dispatchEvent(pointer('pointermove', 150, 300));
			window.dispatchEvent(pointer('pointerup', 150, 300));

			expect(previews).toEqual([
				{ giftId: 'a', groupKey: HIGH, index: 1 },
				{ giftId: 'a', groupKey: LOW, index: 0 },
				{ giftId: 'a', groupKey: NONE, index: 0 },
			]);
			expect(commits).toEqual([{ giftId: 'a', groupKey: NONE, index: 0 }]);
		} finally {
			controller.destroy();
			rendered.container.remove();
		}
	});

	it('anti-flicker regression guard: a layout shift under the pointer never bounces the gift between groups', () => {
		const rendered = renderGroups();
		const { controller, previews } = createGroupedController(rendered);
		try {
			controller.start(pointer('pointerdown', 150, 50), 0);
			window.dispatchEvent(pointer('pointermove', 150, 150));
			expect(previews).toEqual([{ giftId: 'a', groupKey: HIGH, index: 1 }]);

			window.dispatchEvent(pointer('pointermove', 150, 200));
			expect(previews.at(-1)).toEqual({ giftId: 'a', groupKey: LOW, index: 0 });

			// A layout shift moves the high group under the pointer while it keeps moving down.
			rendered.elements[2]!.style.top = '150px';
			window.dispatchEvent(pointer('pointermove', 150, 205));
			expect(previews).toHaveLength(2);

			window.dispatchEvent(pointer('pointermove', 150, 185));
			expect(previews.at(-1)).toEqual({ giftId: 'a', groupKey: HIGH, index: 1 });
		} finally {
			controller.destroy();
			rendered.container.remove();
		}
	});

	it.each([
		['pointercancel', () => window.dispatchEvent(pointer('pointercancel', 150, 300))],
		['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
	])('cancels a cross-group preview on %s without committing', (_name, cancelDrag) => {
		const rendered = renderGroups();
		const { controller, previews, commits, cancellations } = createGroupedController(rendered);
		try {
			controller.start(pointer('pointerdown', 150, 50), 0);
			window.dispatchEvent(pointer('pointermove', 150, 300));
			expect(previews).toEqual([{ giftId: 'a', groupKey: NONE, index: 0 }]);
			cancelDrag();
			expect(commits).toEqual([]);
			expect(cancellations).toHaveLength(1);
			expect(document.querySelector('[data-gift-reorder-overlay]')).toBeNull();
		} finally {
			controller.destroy();
			rendered.container.remove();
		}
	});

	it('mirrors the re-rendered dragged card, with its live group badge, into the overlay', async () => {
		const rendered = renderGroups();
		const { controller } = createGroupedController(rendered, (placement) => {
			// Stands in for Svelte re-rendering the dragged card with its new group badge.
			rendered.items[0]!.textContent = `a ${placement.groupKey}`;
		});
		try {
			controller.start(pointer('pointerdown', 150, 50), 0);
			window.dispatchEvent(pointer('pointermove', 150, 200));
			await expect
				.poll(
					() =>
						document.querySelector<HTMLElement>('[data-gift-reorder-overlay]')
							?.textContent,
				)
				.toBe(`a ${LOW}`);
			expect(rendered.items[0]!.style.visibility).toBe('hidden');
		} finally {
			controller.destroy();
			rendered.container.remove();
		}
	});
});
