<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { CopyField } from '$lib/components/derived/copy-field/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import AccessGrantDetails from './AccessGrantDetails.svelte';
	import { accessTokenAbilitySentence } from '$lib/modules/access_tokens/access_token_display.js';
	import type { CreatedAccessToken } from '$lib/modules/access_tokens/index.js';
	import BotIcon from '@lucide/svelte/icons/bot';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

	interface TokenRevealPanelProps {
		created: CreatedAccessToken;
		/** The prefix of the value a regeneration replaced; null for a new token. */
		replacedPrefix?: string | null;
		/** Where the API is served, shown in the quick start. */
		apiBaseUrl: string;
		oncopied: () => void;
	}

	let { created, replacedPrefix = null, apiBaseUrl, oncopied }: TokenRevealPanelProps = $props();

	const idPrefix = $props.id();

	let copyField = $state<ReturnType<typeof CopyField> | null>(null);

	const token = $derived(created.token);

	export function focusCopyButton() {
		copyField?.focusCopyButton();
	}
</script>

<div class="flex flex-col gap-5" data-testid="token-reveal-panel">
	<Alert.Root tone="warning" role="alert">
		<TriangleAlertIcon aria-hidden="true" />
		<Alert.Description>{m.access_tokens_shown_once()}</Alert.Description>
	</Alert.Root>

	{#if replacedPrefix !== null}
		<Alert.Root tone="danger" role="note">
			<CircleAlertIcon aria-hidden="true" />
			<Alert.Description>
				{m.access_tokens_replaced_note({ prefix: `${replacedPrefix}…` })}
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="flex flex-col gap-1.5">
		<Label for="{idPrefix}-value">{m.access_tokens_value_label()}</Label>
		<CopyField
			bind:this={copyField}
			id="{idPrefix}-value"
			value={created.value}
			kind="secret"
			size="lg"
			{oncopied}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<span class="text-(length:--text-sm) font-semibold">{m.access_tokens_quick_start()}</span>
		<dl class="quick-start font-mono">
			<dt class="text-muted-foreground">API</dt>
			<dd>{apiBaseUrl}</dd>
			<dt class="text-muted-foreground">Authorization</dt>
			<dd>Bearer {token.prefix}…</dd>
		</dl>
	</div>

	<section class="summary" aria-labelledby="{idPrefix}-summary">
		<span id="{idPrefix}-summary" class="text-(length:--text-sm) font-semibold">
			{m.access_tokens_granted()}
		</span>
		<p class="flex items-start gap-1.5 text-(length:--text-base) font-semibold">
			<BotIcon class="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
			<span>{accessTokenAbilitySentence(token.scopes, token.wishlists?.length ?? null)}</span>
		</p>
		<Separator />
		<AccessGrantDetails {token} />
	</section>
</div>

<style>
	.quick-start {
		display: grid;
		grid-template-columns: max-content max-content;
		column-gap: var(--space-4);
		padding: 10px var(--space-3);
		overflow-x: auto;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-btn);
		background: var(--muted);
		font-size: var(--text-sm);
		line-height: 1.6;
		white-space: nowrap;
	}

	.summary {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px var(--space-4);
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-badge);
	}
</style>
