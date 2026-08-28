<script module lang="ts">
	const STANDARD_EASING = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
	const CATEGORY_REFLOW_DURATION = 520;
	const CATEGORY_DELETE_DURATION = 440;

	interface CategoryPosition {
		left: number;
		top: number;
	}

	export interface CategoryMotionSnapshot {
		readonly run: number;
		readonly positions: ReadonlyMap<string, CategoryPosition>;
		readonly retainedVisual: HTMLElement | null;
	}

	interface CategorySettingsMotionOptions {
		reducedMotion?: () => boolean;
	}

	function renderedRectangle(element: HTMLElement, rectangle: DOMRect): boolean {
		if (
			!element.isConnected ||
			element.hidden ||
			rectangle.width <= 0 ||
			rectangle.height <= 0
		) {
			return false;
		}
		const style = getComputedStyle(element);
		return style.display !== 'none' && style.visibility !== 'hidden';
	}

	function categoryRows(root: ParentNode): HTMLElement[] {
		return Array.from(root.querySelectorAll<HTMLElement>('[data-category-row]'));
	}

	function capturePositions(root: ParentNode): Map<string, CategoryPosition> {
		const positions = new Map<string, CategoryPosition>();
		for (const element of categoryRows(root)) {
			const id = element.dataset.categoryId;
			if (id === undefined || id === '') continue;
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
		const animations = new Set<Animation>();
		const retainedVisuals = new Set<HTMLElement>();

		function removeVisual(visual: HTMLElement) {
			visual.remove();
			visual.style.cssText = '';
			if (visual.hasAttribute('style')) visual.attributes.removeNamedItem('style');
			retainedVisuals.delete(visual);
		}

		function cancel() {
			run += 1;
			for (const animation of animations) animation.cancel();
			animations.clear();
			for (const visual of retainedVisuals) removeVisual(visual);
		}

		function capture(root: ParentNode, deletingId?: string): CategoryMotionSnapshot {
			cancel();
			const positions = capturePositions(root);
			const source =
				deletingId === undefined
					? null
					: (categoryRows(root).find((row) => row.dataset.categoryId === deletingId) ??
						null);
			const retainedVisual =
				reducedMotion() ||
				deletingId === undefined ||
				source === null ||
				!positions.has(deletingId)
					? null
					: retainedCategoryVisual(source);
			if (retainedVisual !== null) retainedVisuals.add(retainedVisual);
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
				if (snapshot.retainedVisual !== null) removeVisual(snapshot.retainedVisual);
				return;
			}
			const settlements: Promise<unknown>[] = [];
			const nextPositions = capturePositions(root);
			for (const element of categoryRows(root)) {
				const id = element.dataset.categoryId;
				const before = id === undefined ? undefined : snapshot.positions.get(id);
				const after = id === undefined ? undefined : nextPositions.get(id);
				if (before === undefined || after === undefined) continue;
				const x = before.left - after.left;
				const y = before.top - after.top;
				if (x === 0 && y === 0) continue;
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

		function discard(snapshot: CategoryMotionSnapshot) {
			if (snapshot.retainedVisual !== null) removeVisual(snapshot.retainedVisual);
		}

		function destroy() {
			cancel();
		}

		return { capture, play, discard, cancel, destroy };
	}
</script>

<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import {
		createCustomGiftCategoryCommand,
		deleteCustomGiftCategoryCommand,
		getGiftCategories,
		renameCustomGiftCategoryCommand,
		reorderGiftCategories,
		togglePresetGiftCategory,
	} from '$lib/modules/gift-categories/gift_categories.remote.js';
	import {
		GIFT_CATEGORY_PRESETS,
		labelForGiftCategory,
		type ManagedGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { translateServerError } from '$lib/modules/errors/translate_server_error.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface Props {
		wishlistId: string;
		isShared: boolean;
	}

	let { wishlistId, isShared }: Props = $props();

	const categoriesQuery = $derived(getGiftCategories(wishlistId));
	const categories = $derived(categoriesQuery.current ?? []);
	const activePresetKeys = $derived(
		new Set(categories.flatMap((category) => category.presetKey ?? [])),
	);
	let customLabel = $state('');
	let renaming = $state<Record<string, string>>({});
	let pending = $state(false);
	let categoryRowsElement: HTMLElement;
	const categoryMotion = createCategorySettingsMotion();

	onDestroy(() => categoryMotion.destroy());

	function categoryLabel(category: ManagedGiftCategory): string {
		return labelForGiftCategory(category, getLocale().startsWith('en') ? 'en' : 'cs');
	}

	async function run(
		work: () => Promise<void>,
		success: string,
		motionSnapshot?: CategoryMotionSnapshot,
	) {
		pending = true;
		try {
			await work();
			await tick();
			if (motionSnapshot !== undefined && categoryRowsElement?.isConnected) {
				void categoryMotion.play(motionSnapshot, categoryRowsElement);
			}
			toastSuccess(success);
		} catch (thrown) {
			if (motionSnapshot !== undefined) categoryMotion.discard(motionSnapshot);
			toastError(translateServerError(thrown));
		} finally {
			pending = false;
		}
	}

	function movedCategoryIds(index: number, direction: -1 | 1): string[] {
		const ids = categories.map((category) => category.id);
		const target = index + direction;
		const [id] = ids.splice(index, 1);
		if (id !== undefined) {
			ids.splice(target, 0, id);
		}
		return ids;
	}

	function reorder(ids: string[]) {
		const snapshot = categoryMotion.capture(categoryRowsElement);
		void run(
			() => reorderGiftCategories({ wishlistId, categoryIds: ids }),
			m.gift_categories_reordered(),
			snapshot,
		);
	}

	function deleteCategory(categoryId: string) {
		const snapshot = categoryMotion.capture(categoryRowsElement, categoryId);
		void run(
			() => deleteCustomGiftCategoryCommand({ categoryId }),
			m.gift_category_deleted(),
			snapshot,
		);
	}
</script>

<div class="flex flex-col gap-5">
	<p class="text-sm text-muted-foreground">{m.gift_categories_settings_hint()}</p>

	<div class="grid gap-2 sm:grid-cols-2">
		{#each GIFT_CATEGORY_PRESETS as preset (preset.key)}
			{@const enabled = activePresetKeys.has(preset.key)}
			<div
				class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
			>
				<div>
					<p class="text-sm font-semibold">
						{preset.labels[getLocale().startsWith('en') ? 'en' : 'cs']}
					</p>
					<p class="text-xs text-muted-foreground">
						{preset.labels.cs} / {preset.labels.en}
					</p>
				</div>
				<Button
					size="sm"
					intent={enabled ? 'outline' : 'primary'}
					disabled={pending}
					onclick={() =>
						void run(
							() =>
								togglePresetGiftCategory({
									wishlistId,
									presetKey: preset.key,
									enabled: !enabled,
								}),
							enabled ? m.gift_category_disabled() : m.gift_category_enabled(),
						)}
				>
					{enabled ? m.gift_category_disable() : m.gift_category_enable()}
				</Button>
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-3" bind:this={categoryRowsElement}>
		<h3 class="text-base font-semibold">{m.gift_categories_active_title()}</h3>
		{#if categories.length === 0}
			<HelpText>{m.gift_categories_empty()}</HelpText>
		{:else}
			{#each categories as category, index (category.id)}
				{@const used = category.usedCount > 0}
				<div
					class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
					data-category-row
					data-category-id={category.id}
				>
					<div class="min-w-0 flex-1">
						{#if category.customLabel === null}
							<p class="truncate text-sm font-semibold">{categoryLabel(category)}</p>
							<p class="text-xs text-muted-foreground">
								{m.gift_category_preset_locked()}
							</p>
						{:else}
							<Input
								value={renaming[category.id] ?? category.customLabel}
								maxlength={80}
								disabled={pending}
								oninput={(event) =>
									(renaming[category.id] = event.currentTarget.value)}
							/>
							{#if isShared && used}
								<HelpText>{m.gift_category_shared_rename_warning()}</HelpText>
							{/if}
						{/if}
						{#if used}
							<HelpText
								>{m.gift_category_used_count({
									count: category.usedCount,
								})}</HelpText
							>
						{/if}
					</div>
					<Button
						size="icon-sm"
						intent="ghost"
						disabled={pending || index === 0}
						onclick={() => reorder(movedCategoryIds(index, -1))}
						aria-label={m.move_up()}
					>
						<ArrowUpIcon />
					</Button>
					<Button
						size="icon-sm"
						intent="ghost"
						disabled={pending || index === categories.length - 1}
						onclick={() => reorder(movedCategoryIds(index, 1))}
						aria-label={m.move_down()}
					>
						<ArrowDownIcon />
					</Button>
					{#if category.customLabel !== null}
						<Button
							size="sm"
							intent="outline"
							disabled={pending ||
								(renaming[category.id] ?? category.customLabel).trim() ===
									category.customLabel}
							onclick={() =>
								void run(
									() =>
										renameCustomGiftCategoryCommand({
											categoryId: category.id,
											label: (
												renaming[category.id] ??
												category.customLabel ??
												''
											).trim(),
										}),
									m.gift_category_renamed(),
								)}
						>
							{m.save()}
						</Button>
						<Button
							size="icon-sm"
							intent="ghost"
							disabled={pending || used}
							onclick={() => deleteCategory(category.id)}
							aria-label={m.delete()}
						>
							<TrashIcon />
						</Button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<form
		class="flex flex-wrap gap-2"
		onsubmit={(event) => {
			event.preventDefault();
			const label = customLabel.trim();
			if (label === '') return;
			void run(async () => {
				await createCustomGiftCategoryCommand({ wishlistId, label });
				customLabel = '';
			}, m.gift_category_created());
		}}
	>
		<Input
			bind:value={customLabel}
			maxlength={80}
			placeholder={m.gift_category_custom_placeholder()}
			class="min-w-56 flex-1"
		/>
		<Button type="submit" disabled={pending || customLabel.trim() === ''}
			>{m.gift_category_create()}</Button
		>
	</form>

	<Alert.Root>
		<Alert.Description>{m.gift_categories_no_tags()}</Alert.Description>
	</Alert.Root>
</div>
