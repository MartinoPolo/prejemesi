import { expect, type Locator, type Page } from '@playwright/test';

export const DROPDOWN_LAYER_SELECTOR =
	'[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]';

export interface DropdownTransitionSample {
	id: number;
	closeRunId: number;
	slot: string | null;
	state: string | null;
	connected: boolean;
	opacity: number;
	pointerEvents: string;
	phase: 'frame' | 'animation-end-event' | 'animation-finished' | 'open' | 'detached';
	runningAnimations: number;
}

declare global {
	interface Window {
		__dropdownTransitionSamples?: DropdownTransitionSample[];
	}
}

export async function installDropdownTransitionSampler(page: Page): Promise<void> {
	await page.evaluate((selector) => {
		const samples: DropdownTransitionSample[] = [];
		const elementIds = new WeakMap<Element, number>();
		const activeCloseRunIds = new WeakMap<Element, number>();
		const observedAnimations = new WeakSet<Animation>();
		let nextElementId = 1;
		let nextCloseRunId = 1;
		window.__dropdownTransitionSamples = samples;

		const elementId = (element: Element): number => {
			const existingId = elementIds.get(element);
			if (existingId !== undefined) {
				return existingId;
			}
			const id = nextElementId;
			nextElementId += 1;
			elementIds.set(element, id);
			return id;
		};

		const recordTerminal = (element: Element, phase: 'open' | 'detached'): void => {
			const closeRunId = activeCloseRunIds.get(element);
			if (closeRunId === undefined) {
				return;
			}
			const connected = element.isConnected;
			const style = connected ? getComputedStyle(element) : undefined;
			samples.push({
				id: elementId(element),
				closeRunId,
				slot: element.getAttribute('data-slot'),
				state: element.getAttribute('data-state'),
				connected,
				opacity: style ? Number.parseFloat(style.opacity) : Number.NaN,
				pointerEvents: style?.pointerEvents ?? '',
				phase,
				runningAnimations: connected
					? element
							.getAnimations()
							.filter((animation) => animation.playState === 'running').length
					: 0,
			});
			activeCloseRunIds.delete(element);
		};

		const record = (
			element: Element,
			phase: 'frame' | 'animation-end-event' | 'animation-finished',
			animationCloseRunId?: number,
		): void => {
			if (!element.isConnected) {
				return;
			}
			if (element.getAttribute('data-state') !== 'closed') {
				recordTerminal(element, 'open');
				return;
			}

			let closeRunId = activeCloseRunIds.get(element);
			if (closeRunId === undefined) {
				closeRunId = nextCloseRunId;
				nextCloseRunId += 1;
				activeCloseRunIds.set(element, closeRunId);
			}
			if (animationCloseRunId !== undefined && animationCloseRunId !== closeRunId) {
				return;
			}

			const style = getComputedStyle(element);
			const animations = element.getAnimations();
			samples.push({
				id: elementId(element),
				closeRunId,
				slot: element.getAttribute('data-slot'),
				state: element.getAttribute('data-state'),
				connected: true,
				opacity: Number.parseFloat(style.opacity),
				pointerEvents: style.pointerEvents,
				phase,
				runningAnimations: animations.filter(
					(animation) => animation.playState === 'running',
				).length,
			});

			for (const animation of animations) {
				if (observedAnimations.has(animation)) {
					continue;
				}
				observedAnimations.add(animation);
				const observedCloseRunId = closeRunId;
				void animation.finished.then(
					() => record(element, 'animation-finished', observedCloseRunId),
					() => undefined,
				);
			}
		};

		document.addEventListener(
			'animationend',
			(event) => {
				if (event.target instanceof Element && event.target.matches(selector)) {
					record(event.target, 'animation-end-event');
				}
			},
			true,
		);

		const mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && mutation.target instanceof Element) {
					record(mutation.target, 'frame');
					continue;
				}
				for (const removedNode of mutation.removedNodes) {
					if (!(removedNode instanceof Element)) {
						continue;
					}
					const removedLayers = [
						...(removedNode.matches(selector) ? [removedNode] : []),
						...removedNode.querySelectorAll(selector),
					];
					for (const element of removedLayers) {
						if (!element.isConnected) {
							recordTerminal(element, 'detached');
						}
					}
				}
			}
		});
		mutationObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-state'],
			childList: true,
			subtree: true,
		});

		const sampleFrame = (): void => {
			for (const element of document.querySelectorAll(selector)) {
				record(element, 'frame');
			}
			requestAnimationFrame(sampleFrame);
		};
		requestAnimationFrame(sampleFrame);
	}, DROPDOWN_LAYER_SELECTOR);
}

export async function resetDropdownTransitionSamples(page: Page): Promise<void> {
	await page.evaluate(() => {
		window.__dropdownTransitionSamples?.splice(0);
	});
}

export async function dropdownTransitionSamples(page: Page): Promise<DropdownTransitionSample[]> {
	return page.evaluate(() => window.__dropdownTransitionSamples ?? []);
}

export async function expectClosedLayersKeepTheirExitEndpoint(
	page: Page,
	expectedSlots: readonly string[],
): Promise<void> {
	await expect
		.poll(async () => {
			const samples = await dropdownTransitionSamples(page);
			const observedRuns = samples.filter((sample) =>
				expectedSlots.includes(sample.slot ?? ''),
			);
			const completedRuns = observedRuns.filter(
				(sample) => sample.phase === 'animation-end-event',
			);
			return (
				expectedSlots.every((slot) =>
					completedRuns.some((sample) => sample.slot === slot),
				) &&
				observedRuns.every((observedRun) =>
					samples.some(
						(sample) =>
							sample.closeRunId === observedRun.closeRunId &&
							(sample.phase === 'detached' || sample.phase === 'open'),
					),
				)
			);
		})
		.toBe(true);

	const samples = await dropdownTransitionSamples(page);
	const completedCloseRunIds = new Set(
		samples
			.filter(
				(sample) =>
					expectedSlots.includes(sample.slot ?? '') &&
					sample.phase === 'animation-end-event',
			)
			.map((sample) => sample.closeRunId),
	);
	const invalidSamples = samples.filter((sample, sampleIndex) => {
		if (!completedCloseRunIds.has(sample.closeRunId)) {
			return false;
		}
		const exitEndIndex = samples.findIndex(
			(candidate) =>
				candidate.closeRunId === sample.closeRunId &&
				candidate.phase === 'animation-end-event',
		);
		return (
			sampleIndex >= exitEndIndex &&
			sample.connected &&
			sample.state === 'closed' &&
			(sample.opacity > 0.02 || sample.pointerEvents !== 'none')
		);
	});
	const incompleteAnimationEnds = samples.filter(
		(sample) =>
			completedCloseRunIds.has(sample.closeRunId) &&
			sample.phase === 'animation-end-event' &&
			sample.runningAnimations !== 0,
	);

	expect(
		invalidSamples.map(({ closeRunId, slot, phase, opacity, pointerEvents }) => ({
			closeRunId,
			slot,
			phase,
			opacity,
			pointerEvents,
		})),
	).toEqual([]);
	expect(
		incompleteAnimationEnds.map(({ closeRunId, slot, runningAnimations }) => ({
			closeRunId,
			slot,
			runningAnimations,
		})),
	).toEqual([]);
}

export async function visibleDropdownRoot(page: Page): Promise<Locator> {
	const root = page.locator('[data-slot="dropdown-menu-content"]:visible').last();
	await expect(root).toBeVisible();
	return root;
}

export async function hoverDisplaySubmenu(root: Locator, name: RegExp): Promise<Locator> {
	const trigger = root.getByRole('menuitem', { name });
	await trigger.hover();
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	const controlledId = await trigger.getAttribute('aria-controls');
	expect(controlledId).toBeTruthy();
	const submenu = root.page().locator(`[id=${JSON.stringify(controlledId)}]`);
	await expect(submenu).toBeVisible();
	return submenu;
}
