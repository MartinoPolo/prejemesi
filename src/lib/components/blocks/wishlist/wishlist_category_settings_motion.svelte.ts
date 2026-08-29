import { SvelteMap, SvelteSet } from 'svelte/reactivity';

const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const CATEGORY_REFLOW_DURATION = 520;
const CATEGORY_DELETE_DURATION = 440;

interface CategoryPosition {
	left: number;
	top: number;
}

interface CategoryMotionSnapshot {
	readonly run: number;
	readonly positions: ReadonlyMap<string, CategoryPosition>;
	readonly retainedVisual: HTMLElement | null;
}

interface CategorySettingsMotionOptions {
	reducedMotion?: () => boolean;
}

function renderedRectangle(element: HTMLElement, rectangle: DOMRect): boolean {
	if (!element.isConnected || element.hidden || rectangle.width <= 0 || rectangle.height <= 0) {
		return false;
	}
	const style = getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

function categoryRows(root: ParentNode): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>('[data-category-row]'));
}

function capturePositions(root: ParentNode): SvelteMap<string, CategoryPosition> {
	const positions = new SvelteMap<string, CategoryPosition>();
	for (const element of categoryRows(root)) {
		const id = element.dataset.categoryId;
		if (id === undefined || id === '') {
			continue;
		}
		const rectangle = element.getBoundingClientRect();
		if (renderedRectangle(element, rectangle)) {
			positions.set(id, { left: rectangle.left, top: rectangle.top });
		}
	}
	return positions;
}

function stripIds(element: HTMLElement) {
	element.removeAttribute('id');
	for (const descendant of element.querySelectorAll('[id]')) {
		descendant.removeAttribute('id');
	}
}

function retainedCategoryVisual(source: HTMLElement): HTMLElement {
	const rectangle = source.getBoundingClientRect();
	const clone = source.cloneNode(true) as HTMLElement;
	stripIds(clone);
	clone.removeAttribute('data-category-row');
	clone.removeAttribute('data-category-id');
	clone.setAttribute('aria-hidden', 'true');
	clone.inert = true;
	Object.assign(clone.style, {
		position: 'fixed',
		left: `${rectangle.left}px`,
		top: `${rectangle.top}px`,
		width: `${rectangle.width}px`,
		height: `${rectangle.height}px`,
		margin: '0px',
		boxSizing: 'border-box',
		pointerEvents: 'none',
		transformOrigin: 'top center',
		zIndex: '100',
	});
	return clone;
}

export function createCategorySettingsMotion(options: CategorySettingsMotionOptions = {}) {
	const reducedMotion =
		options.reducedMotion ??
		(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
	let run = 0;
	const animations = new SvelteSet<Animation>();
	const retainedVisuals = new SvelteSet<HTMLElement>();

	function removeVisual(visual: HTMLElement) {
		visual.remove();
		visual.style.cssText = '';
		if (visual.hasAttribute('style')) {
			visual.attributes.removeNamedItem('style');
		}
		retainedVisuals.delete(visual);
	}

	function cancel() {
		run += 1;
		for (const animation of animations) {
			animation.cancel();
		}
		animations.clear();
		for (const visual of retainedVisuals) {
			removeVisual(visual);
		}
	}

	function capture(root: ParentNode, deletingId?: string): CategoryMotionSnapshot {
		cancel();
		const positions = capturePositions(root);
		const source =
			deletingId === undefined
				? null
				: (categoryRows(root).find((row) => row.dataset.categoryId === deletingId) ?? null);
		const retainedVisual =
			reducedMotion() ||
			deletingId === undefined ||
			source === null ||
			!positions.has(deletingId)
				? null
				: retainedCategoryVisual(source);
		if (retainedVisual !== null) {
			retainedVisuals.add(retainedVisual);
		}
		return { run, positions, retainedVisual };
	}

	function track(animation: Animation): Promise<unknown> {
		animations.add(animation);
		return (animation.finished ?? Promise.resolve())
			.catch(() => undefined)
			.finally(() => animations.delete(animation));
	}

	async function play(snapshot: CategoryMotionSnapshot, root: ParentNode) {
		if (snapshot.run !== run || reducedMotion()) {
			if (snapshot.retainedVisual !== null) {
				removeVisual(snapshot.retainedVisual);
			}
			return;
		}
		const settlements: Promise<unknown>[] = [];
		const nextPositions = capturePositions(root);
		for (const element of categoryRows(root)) {
			const id = element.dataset.categoryId;
			const before = id === undefined ? undefined : snapshot.positions.get(id);
			const after = id === undefined ? undefined : nextPositions.get(id);
			if (before === undefined || after === undefined) {
				continue;
			}
			const x = before.left - after.left;
			const y = before.top - after.top;
			if (x === 0 && y === 0) {
				continue;
			}
			settlements.push(
				track(
					element.animate(
						[
							{ transform: `translate(${x}px, ${y}px)` },
							{ transform: 'translate(0, 0)' },
						],
						{ duration: CATEGORY_REFLOW_DURATION, easing: STANDARD_EASING },
					),
				),
			);
		}
		const visual = snapshot.retainedVisual;
		if (visual !== null) {
			visual.ownerDocument.body.append(visual);
			const exit = track(
				visual.animate(
					[
						{ opacity: 1, transform: 'scaleY(1)' },
						{ opacity: 0, transform: 'scaleY(0)' },
					],
					{
						duration: CATEGORY_DELETE_DURATION,
						easing: STANDARD_EASING,
						fill: 'both',
					},
				),
			).finally(() => removeVisual(visual));
			settlements.push(exit);
		}
		await Promise.all(settlements);
	}

	function destroy() {
		cancel();
	}

	return { capture, play, cancel, destroy };
}
