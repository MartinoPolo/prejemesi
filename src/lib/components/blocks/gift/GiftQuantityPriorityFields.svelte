<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { getPriorityDisplay } from '$lib/modules/gifts/gift_display.js';
	import type { GiftPriorityLevel } from '$lib/modules/gifts/types.js';

	interface Props {
		quantity: number;
		priorityLevelId: string;
		priorityLevels: GiftPriorityLevel[];
		/** After sharing the quantity may only grow from the saved one. */
		locked: boolean;
		savedQuantity: number;
		/** The parent renders the lock hint across its whole row so it stays on one line. */
		lockHintId: string | undefined;
		/** Classes for each field cell, so the parent row lays them out with its other fields. */
		fieldClass: string;
		labelRowClass: string;
	}

	let {
		quantity = $bindable(),
		priorityLevelId = $bindable(),
		priorityLevels,
		locked,
		savedQuantity,
		lockHintId,
		fieldClass,
		labelRowClass,
	}: Props = $props();

	const selectedPriorityLabel = $derived(
		priorityLevels.find((level) => level.id === priorityLevelId)?.label ?? null,
	);
</script>

<div class={fieldClass}>
	<div class={labelRowClass}>
		<Label for="gift-quantity">{m.gift_quantity_label()}</Label>
	</div>
	<Input
		id="gift-quantity"
		class="numeric-input"
		bind:value={quantity}
		type="number"
		min={locked ? String(savedQuantity) : '1'}
		placeholder="1"
		aria-describedby={lockHintId}
	/>
</div>
{#if priorityLevels.length > 0}
	<div class={fieldClass}>
		<div class={labelRowClass}>
			<Label for="gift-priority">{m.gift_priority_label()}</Label>
		</div>
		<Select.Root type="single" bind:value={priorityLevelId}>
			<Select.Trigger id="gift-priority" class="w-full">
				{#if selectedPriorityLabel !== null}
					{getPriorityDisplay(selectedPriorityLabel)?.label() ?? selectedPriorityLabel}
				{:else if priorityLevelId !== ''}
					{m.gift_priority_select()}
				{:else}
					{m.gift_priority_none()}
				{/if}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					<Select.Item value="" label={m.gift_priority_none()}>
						{m.gift_priority_none()}
					</Select.Item>
					{#each priorityLevels as level (level.id)}
						{@const levelLabel =
							getPriorityDisplay(level.label)?.label() ?? level.label}
						<Select.Item value={level.id} label={levelLabel}>{levelLabel}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</div>
{/if}
