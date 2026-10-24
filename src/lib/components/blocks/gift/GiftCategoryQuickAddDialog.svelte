<script lang="ts" module>
	/** What the new category is for: gifts it is assigned to at once, or the gift editor's draft. */
	export type GiftCategoryQuickAddTarget =
		| { kind: 'gifts'; giftIds: string[]; giftName?: string; hiddenCount?: number }
		| { kind: 'editor' };
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { toastError, toastSuccess } from '$lib/components/base/toast/index.js';
	import { ColorPicker } from '$lib/components/derived/color-picker/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';
	import { createGiftCategoryCommand } from '$lib/modules/gift-categories/gift_categories.remote.js';
	import { giftCategoryColorForIndex } from '$lib/modules/gift-categories/gift_category_colors.js';
	import {
		MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH,
		normalizeGiftCategoryLabel,
		occupiedGiftCategoryLabels,
		type PublicGiftCategory,
	} from '$lib/modules/gift-categories/types.js';
	import {
		getServerErrorCode,
		translateServerError,
	} from '$lib/modules/errors/translate_server_error.js';
	import { SERVER_ERROR } from '$lib/modules/errors/server_error_codes.js';

	interface Props {
		open: boolean;
		wishlistId: string;
		target: GiftCategoryQuickAddTarget;
		/** The wishlist's enabled categories, for the duplicate check and the next default color. */
		categories: readonly PublicGiftCategory[];
		oncreated?: (category: PublicGiftCategory) => void;
	}

	let { open = $bindable(false), wishlistId, target, categories, oncreated }: Props = $props();

	const fieldId = $props.id();
	let label = $state('');
	let color = $state(giftCategoryColorForIndex(0));
	let saving = $state(false);
	let serverLabelError = $state<string | undefined>(undefined);

	const trimmedLabel = $derived(label.trim());
	const duplicatesExistingLabel = $derived.by(() => {
		const normalized = normalizeGiftCategoryLabel(trimmedLabel);
		if (normalized === '') {
			return false;
		}
		return categories.some((category) =>
			occupiedGiftCategoryLabels(category).includes(normalized),
		);
	});
	const labelError = $derived(
		duplicatesExistingLabel ? m.server_error_gift_category_label_conflict() : serverLabelError,
	);
	const description = $derived(
		target.kind === 'editor'
			? m.gift_category_quick_add_editor()
			: target.giftIds.length === 1 && target.giftName !== undefined
				? m.gift_category_quick_add_assign_one({ name: target.giftName })
				: m.gift_category_quick_add_assign_many({ count: target.giftIds.length }),
	);

	$effect(() => {
		if (open) {
			label = '';
			serverLabelError = undefined;
			color = giftCategoryColorForIndex(
				untrack(() => categories.filter((category) => category.presetKey === null).length),
			);
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (trimmedLabel === '' || duplicatesExistingLabel || saving) {
			return;
		}
		saving = true;
		try {
			const category = await createGiftCategoryCommand({
				wishlistId,
				label: trimmedLabel,
				color,
				giftIds: target.kind === 'gifts' ? target.giftIds : [],
			});
			toastSuccess(m.gift_category_created());
			oncreated?.(category);
			open = false;
		} catch (thrown) {
			if (getServerErrorCode(thrown) === SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT) {
				serverLabelError = translateServerError(thrown);
			} else {
				toastError(translateServerError(thrown));
			}
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content size="sm" data-testid="gift-category-quick-add">
		<Dialog.Header>
			<Dialog.Title>{m.gift_category_create()}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
			<Field
				{fieldId}
				label={m.gift_category_quick_add_name_label()}
				errorMessage={labelError}
			>
				{#snippet children({ hasError, errorId }: FieldControlContext)}
					<div class="flex items-center gap-2">
						<ColorPicker
							bind:value={color}
							label={m.gift_category_quick_add_color_label()}
							disabled={saving}
						/>
						<Input
							id={fieldId}
							class="min-w-0 flex-1"
							bind:value={label}
							placeholder={m.gift_category_custom_placeholder()}
							maxlength={MAX_CUSTOM_GIFT_CATEGORY_LABEL_LENGTH}
							required
							disabled={saving}
							state={hasError ? 'error' : 'default'}
							aria-invalid={hasError ? true : undefined}
							aria-describedby={errorId}
							oninput={() => (serverLabelError = undefined)}
						/>
					</div>
				{/snippet}
			</Field>
			{#if target.kind === 'gifts' && (target.hiddenCount ?? 0) > 0}
				<HelpText
					>{m.gift_category_quick_add_hidden({
						count: target.hiddenCount ?? 0,
					})}</HelpText
				>
			{/if}
			<Dialog.Footer>
				<Button
					type="button"
					intent="outline"
					onclick={() => (open = false)}
					disabled={saving}
				>
					{m.cancel()}
				</Button>
				<Button
					type="submit"
					disabled={saving || trimmedLabel === '' || duplicatesExistingLabel}
				>
					{#if saving}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
					{/if}
					{target.kind === 'editor'
						? m.gift_category_create()
						: m.gift_category_quick_add_submit()}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
