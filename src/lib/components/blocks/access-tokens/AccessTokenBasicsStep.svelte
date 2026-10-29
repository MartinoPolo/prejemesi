<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { FieldError } from '$lib/components/derived/field/index.js';
	import AccessTokenExpiryField from './AccessTokenExpiryField.svelte';
	import AccessTokenWishlistRestrictionField from './AccessTokenWishlistRestrictionField.svelte';
	import type { WishlistRestriction } from './access_token_form.js';
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

	<AccessTokenWishlistRestrictionField
		bind:restriction
		bind:selectedWishlistIds
		bind:wishlistSearch
		bind:wishlistsError
	/>

	<AccessTokenExpiryField
		bind:value={expiryDays}
		label={m.access_tokens_expiry_label()}
		help={m.access_tokens_expiry_help()}
		resultLabel={(date) => m.access_tokens_expires_on({ date })}
		markDefault
	/>
</fieldset>
