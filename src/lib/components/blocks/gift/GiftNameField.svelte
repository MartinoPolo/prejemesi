<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { Field, type FieldControlContext } from '$lib/components/derived/field/index.js';

	interface Props {
		name: string;
		/** A shared gift keeps its name; the tooltip explains why. */
		frozen: boolean;
		errorMessage: string;
	}

	let { name = $bindable(), frozen, errorMessage }: Props = $props();
</script>

{#snippet nameInput({ hasError, errorId }: FieldControlContext)}
	<Input
		id="gift-name"
		class={cn(frozen && 'pointer-events-none')}
		bind:value={name}
		placeholder={m.gift_name_placeholder()}
		disabled={frozen}
		state={hasError ? 'error' : 'default'}
		aria-invalid={hasError ? true : undefined}
		aria-describedby={errorId}
	/>
{/snippet}

<Field fieldId="gift-name" label={m.gift_name_label()} {errorMessage}>
	{#snippet children(control: FieldControlContext)}
		{#if frozen}
			<SimpleTooltip text={m.gift_name_frozen_hint()} side="top">
				{#snippet asChild(tooltipProps)}
					<div {...tooltipProps} tabindex="-1" class="w-full">
						{@render nameInput(control)}
					</div>
				{/snippet}
			</SimpleTooltip>
		{:else}
			{@render nameInput(control)}
		{/if}
	{/snippet}
</Field>
