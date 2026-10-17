<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import {
		accessTokenExpiryAfter,
		accessTokenExpiryPresetLabel,
		formatAccessTokenDate,
		isAccessTokenExpiryPreset,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import {
		ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS,
		ACCESS_TOKEN_EXPIRY_PRESET_DAYS,
		type AccessTokenExpiryPresetDays,
	} from '$lib/modules/access_tokens/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';

	interface AccessTokenExpiryFieldProps {
		value: AccessTokenExpiryPresetDays;
		label: string;
		help: string;
		/** The result line for the chosen expiry date, e.g. "Vyprší 13. 10. 2027". */
		resultLabel: (date: string) => string;
		/** Marks the default preset in the options. */
		markDefault?: boolean;
		disabled?: boolean;
	}

	let {
		value = $bindable(),
		label,
		help,
		resultLabel,
		markDefault = false,
		disabled = false,
	}: AccessTokenExpiryFieldProps = $props();

	const idPrefix = $props.id();

	function optionLabel(days: AccessTokenExpiryPresetDays): string {
		const duration = accessTokenExpiryPresetLabel(days);
		return markDefault && days === ACCESS_TOKEN_DEFAULT_EXPIRY_DAYS
			? m.access_tokens_expiry_default({ duration })
			: duration;
	}
</script>

<div class="flex flex-col gap-1.5">
	<Label for="{idPrefix}-select">{label}</Label>
	<Select.Root
		type="single"
		value={String(value)}
		onValueChange={(selected) => {
			const days = Number(selected);
			if (isAccessTokenExpiryPreset(days)) {
				value = days;
			}
		}}
		{disabled}
	>
		<Select.Trigger
			id="{idPrefix}-select"
			class="w-full sm:w-55"
			aria-describedby="{idPrefix}-result {idPrefix}-help"
		>
			{optionLabel(value)}
		</Select.Trigger>
		<Select.Content>
			<Select.Group>
				{#each ACCESS_TOKEN_EXPIRY_PRESET_DAYS as days (days)}
					<Select.Item value={String(days)} label={optionLabel(days)}>
						{optionLabel(days)}
					</Select.Item>
				{/each}
			</Select.Group>
		</Select.Content>
	</Select.Root>
	<p
		id="{idPrefix}-result"
		class="flex items-center gap-1.5 text-(length:--text-md) font-semibold"
		aria-live="polite"
	>
		<CalendarIcon class="size-3.5 text-brand" aria-hidden="true" />
		<span>{resultLabel(formatAccessTokenDate(accessTokenExpiryAfter(value)))}</span>
	</p>
	<HelpText id="{idPrefix}-help" class="mt-0">{help}</HelpText>
</div>
