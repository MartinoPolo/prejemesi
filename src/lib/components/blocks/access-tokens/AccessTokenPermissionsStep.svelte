<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import { cn } from '$lib/utils.js';
	import ScopePicker from './ScopePicker.svelte';
	import type { AgentScope } from '$lib/modules/access_tokens/index.js';
	import ZapIcon from '@lucide/svelte/icons/zap';

	interface AccessTokenPermissionsStepProps {
		scopes: AgentScope[];
		fastForward: boolean;
		disabled: boolean;
	}

	let {
		scopes = $bindable(),
		fastForward = $bindable(),
		disabled,
	}: AccessTokenPermissionsStepProps = $props();

	const idPrefix = $props.id();
</script>

<fieldset class="flex min-w-0 flex-col gap-5.5" {disabled}>
	<legend class="sr-only">{m.access_tokens_step_permissions()}</legend>
	<ScopePicker bind:selected={scopes} {disabled} />
	<div class={cn('fast-forward', fastForward && 'is-on')}>
		<div class="flex items-center justify-between gap-3">
			<Label
				for="{idPrefix}-fast-forward"
				class="flex items-center gap-2 text-(length:--text-md) font-semibold"
			>
				<ZapIcon class="size-4" aria-hidden="true" />
				{m.access_tokens_fast_forward()}
			</Label>
			<Switch
				id="{idPrefix}-fast-forward"
				bind:checked={fastForward}
				aria-describedby="{idPrefix}-fast-forward-help"
			/>
		</div>
		<p id="{idPrefix}-fast-forward-help" class="text-(length:--text-sm) text-muted-foreground">
			{m.access_tokens_fast_forward_help()}
			<strong class="font-semibold text-foreground">
				{m.access_tokens_fast_forward_confirmations()}
			</strong>
		</p>
	</div>
</fieldset>

<style>
	.fast-forward {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: 14px var(--space-4);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-badge);
	}

	.fast-forward.is-on {
		border-color: color-mix(in oklab, var(--status-warning) 70%, var(--ink));
		background: color-mix(in oklab, var(--status-warning) 8%, var(--card));
	}
</style>
