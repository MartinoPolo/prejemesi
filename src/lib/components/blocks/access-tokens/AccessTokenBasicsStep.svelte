<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as RadioGroup from '$lib/components/base/radio-group/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { choiceRowVariants } from '$lib/components/derived/choice-row/index.js';
	import { FieldError } from '$lib/components/derived/field/index.js';
	import { cn } from '$lib/utils.js';
	import AccessTokenExpiryField from './AccessTokenExpiryField.svelte';
	import AccessTokenWishlistPicker from './AccessTokenWishlistPicker.svelte';
	import { WISHLIST_RESTRICTION, type WishlistRestriction } from './access_token_form.js';
	import {
		ACCESS_TOKEN_NAME_MAX_LENGTH,
		type AccessTokenExpiryPresetDays,
	} from '$lib/modules/access_tokens/index.js';

	interface AccessTokenBasicsStepProps {
		name: string;
		restriction: WishlistRestriction;
		selectedWishlistIds: string[];
		wishlistSearch: string;
		expiryDays: AccessTokenExpiryPresetDays;
		nameError: boolean;
		wishlistsError: boolean;
		nameInput: HTMLInputElement | null;
	}

	let {
		name = $bindable(),
		restriction = $bindable(),
		selectedWishlistIds = $bindable(),
		wishlistSearch = $bindable(),
		expiryDays = $bindable(),
		nameError = $bindable(),
		wishlistsError = $bindable(),
		nameInput = $bindable(),
	}: AccessTokenBasicsStepProps = $props();

	const idPrefix = $props.id();

	const restrictionOptions = [
		{ value: WISHLIST_RESTRICTION.all, label: m.access_tokens_lists_option_all },
		{ value: WISHLIST_RESTRICTION.some, label: m.access_tokens_lists_option_some },
	];
</script>

<fieldset class="flex min-w-0 flex-col gap-5.5">
	<legend class="sr-only">{m.access_tokens_step_basics()}</legend>

	<div class="flex flex-col gap-1.5">
		<div class="flex items-baseline justify-between gap-2">
			<Label for="{idPrefix}-name">{m.access_tokens_name_label()}</Label>
			<span
				class="text-(length:--text-sm) text-muted-foreground tabular-nums"
				aria-hidden="true"
			>
				{name.length}/{ACCESS_TOKEN_NAME_MAX_LENGTH}
			</span>
		</div>
		<Input
			bind:ref={nameInput}
			bind:value={name}
			id="{idPrefix}-name"
			maxlength={ACCESS_TOKEN_NAME_MAX_LENGTH}
			autocomplete="off"
			placeholder={m.access_tokens_name_placeholder()}
			state={nameError ? 'error' : 'default'}
			aria-invalid={nameError}
			aria-describedby={nameError ? `${idPrefix}-name-error` : `${idPrefix}-name-help`}
			oninput={() => {
				if (name.trim() !== '') {
					nameError = false;
				}
			}}
		/>
		{#if nameError}
			<FieldError id="{idPrefix}-name-error">{m.access_tokens_name_required()}</FieldError>
		{:else}
			<HelpText id="{idPrefix}-name-help" class="mt-0">{m.access_tokens_name_help()}</HelpText
			>
		{/if}
	</div>

	<fieldset class="flex min-w-0 flex-col gap-1.5">
		<legend class="mb-1.5 text-(length:--text-sm) font-semibold">
			{m.access_tokens_lists_label()}
		</legend>
		<RadioGroup.Root
			bind:value={
				() => restriction,
				(next) => {
					restriction =
						next === WISHLIST_RESTRICTION.some
							? WISHLIST_RESTRICTION.some
							: WISHLIST_RESTRICTION.all;
					wishlistsError = false;
				}
			}
			class="flex flex-col gap-0.5"
		>
			{#each restrictionOptions as option (option.value)}
				<label
					for="{idPrefix}-restriction-{option.value}"
					class={cn(
						choiceRowVariants({ selected: restriction === option.value }),
						'gap-2.5 px-2.5 py-2 text-(length:--text-md)',
					)}
				>
					<RadioGroup.Item
						id="{idPrefix}-restriction-{option.value}"
						value={option.value}
					/>
					<span data-slot="choice-row-label">{option.label()}</span>
				</label>
			{/each}
		</RadioGroup.Root>

		{#if restriction === WISHLIST_RESTRICTION.some}
			<AccessTokenWishlistPicker
				bind:selectedIds={selectedWishlistIds}
				bind:search={wishlistSearch}
				bind:missingSelection={wishlistsError}
			/>
		{/if}
	</fieldset>

	<AccessTokenExpiryField
		bind:value={expiryDays}
		label={m.access_tokens_expiry_label()}
		help={m.access_tokens_expiry_help()}
		resultLabel={(date) => m.access_tokens_expires_on({ date })}
		markDefault
	/>
</fieldset>
