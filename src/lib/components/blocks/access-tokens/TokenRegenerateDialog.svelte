<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AccessTokenExpiryField from './AccessTokenExpiryField.svelte';
	import {
		accessTokenExpiryPresetLabel,
		accessTokenRegenerateKeptLine,
		formatAccessTokenDate,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import type {
		AccessTokenExpiryPresetDays,
		AccessTokenSummary,
	} from '$lib/modules/access_tokens/index.js';
	import BanIcon from '@lucide/svelte/icons/ban';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	interface TokenRegenerateDialogProps {
		open: boolean;
		token: AccessTokenSummary;
		/** Regenerates the token; the dialog stays open and blocks closing until it settles. */
		onconfirm: (expiryDays: AccessTokenExpiryPresetDays) => Promise<void>;
	}

	let { open = $bindable(false), token, onconfirm }: TokenRegenerateDialogProps = $props();

	// Each opening starts from the token's own lifetime, so the dialog is keyed by token in the parent.
	// svelte-ignore state_referenced_locally
	let expiryDays = $state<AccessTokenExpiryPresetDays>(token.expiryPresetDays);
	let pending = $state(false);

	function requestOpenChange(nextOpen: boolean) {
		if (!pending) {
			open = nextOpen;
		}
	}

	async function confirm() {
		pending = true;
		try {
			await onconfirm(expiryDays);
		} finally {
			pending = false;
		}
	}
</script>

<Dialog.Root bind:open={() => open, requestOpenChange}>
	<Dialog.Content size="lg" data-testid="token-regenerate-dialog">
		<!-- Left-aligned like the facts box below it, as in the token dialog. -->
		<Dialog.Header class="text-left">
			<Dialog.Title class="in-data-close-button:ps-0">
				{token.expired
					? m.access_tokens_regenerate_expired_title()
					: m.access_tokens_regenerate_title()}
			</Dialog.Title>
			<Dialog.Description class="text-(length:--text-base) text-foreground">
				{token.expired
					? m.access_tokens_regenerate_expired_lead()
					: m.access_tokens_regenerate_lead()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="facts">
			<h3 class="font-sans text-(length:--text-base) font-semibold [overflow-wrap:anywhere]">
				{token.name}
			</h3>
			<ul class="flex flex-col gap-1.5 text-(length:--text-md)">
				<li class="flex items-start gap-2">
					<CheckIcon
						class="mt-0.5 size-3.5 shrink-0 text-status-success-text"
						aria-hidden="true"
					/>
					<span>{accessTokenRegenerateKeptLine(token)}</span>
				</li>
				<li class="flex items-start gap-2">
					<BanIcon
						class="mt-0.5 size-3.5 shrink-0 text-status-danger-text"
						aria-hidden="true"
					/>
					<span>
						{token.expired
							? m.access_tokens_regenerate_ended_expired({
									prefix: `${token.prefix}…`,
									date: formatAccessTokenDate(token.expiresAt),
								})
							: m.access_tokens_regenerate_ended({ prefix: `${token.prefix}…` })}
					</span>
				</li>
			</ul>
		</div>

		<AccessTokenExpiryField
			bind:value={expiryDays}
			label={m.access_tokens_regenerate_expiry_label()}
			help={m.access_tokens_regenerate_expiry_help({
				duration: accessTokenExpiryPresetLabel(token.expiryPresetDays),
			})}
			resultLabel={(date) => m.access_tokens_regenerate_expires_on({ date })}
			disabled={pending}
		/>

		<Dialog.Footer>
			<Button intent="secondary" disabled={pending} onclick={() => requestOpenChange(false)}>
				{m.access_tokens_back()}
			</Button>
			<Button disabled={pending} onclick={confirm}>
				{#if pending}
					<LoaderIcon class="animate-spin" data-icon="inline-start" />
					{m.access_tokens_regenerating()}
				{:else}
					<RefreshCwIcon data-icon="inline-start" />
					{m.access_tokens_regenerate()}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.facts {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: var(--space-3) 14px;
		border: 2px solid var(--border-strong);
		border-radius: var(--radius-badge);
	}
</style>
