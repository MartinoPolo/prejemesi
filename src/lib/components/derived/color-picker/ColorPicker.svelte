<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import {
		CUSTOM_GIFT_CATEGORY_COLORS,
		GIFT_CATEGORY_COLOR_PATTERN,
	} from '$lib/modules/gift-categories/gift_category_colors.js';
	import { colorPickerVariants } from './color_picker_variants.js';

	interface Props {
		value: string;
		label: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
	}

	let { value = $bindable(), label, disabled = false, onValueChange }: Props = $props();
	let open = $state(false);
	let hexDraft = $state(value);
	let nativeInput: HTMLInputElement;
	const styles = colorPickerVariants();

	function commit(candidate: string) {
		if (disabled) {
			return;
		}
		if (!GIFT_CATEGORY_COLOR_PATTERN.test(candidate)) {
			return;
		}
		value = candidate;
		hexDraft = candidate;
		onValueChange?.(candidate);
	}

	$effect(() => {
		if (disabled && open) {
			open = false;
		}
		if (!open) {
			hexDraft = value;
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class={styles.trigger()}
				style:background-color={value}
				aria-label={label}
				{disabled}
			></button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64 space-y-3 p-3" aria-label={label} role="dialog">
		<div class="grid grid-cols-5 gap-2" role="group" aria-label={m.color_picker_presets()}>
			{#each CUSTOM_GIFT_CATEGORY_COLORS as preset (preset)}
				<button
					type="button"
					class={styles.swatch()}
					style:background-color={preset}
					aria-label={preset}
					aria-pressed={value.toUpperCase() === preset}
					onclick={() => commit(preset)}
					{disabled}
				></button>
			{/each}
		</div>
		<label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
			<span>{m.color_picker_hex_label()}</span>
			<Input
				value={hexDraft}
				oninput={(event) => {
					hexDraft = event.currentTarget.value;
					commit(hexDraft);
				}}
				spellcheck="false"
				maxlength={7}
				placeholder="#RRGGBB"
				{disabled}
			/>
		</label>
		<Button
			type="button"
			intent="outline"
			size="sm"
			onclick={() => nativeInput.click()}
			{disabled}
		>
			{m.color_picker_native_action()}
		</Button>
	</Popover.Content>
</Popover.Root>

<input
	bind:this={nativeInput}
	type="color"
	class="sr-only"
	{value}
	{disabled}
	aria-label={label}
	aria-hidden="true"
	tabindex="-1"
	oninput={(event) => commit(event.currentTarget.value)}
/>
