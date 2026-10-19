<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import ScopePicker from './ScopePicker.svelte';
	import AccessTokenWishlistRestrictionField from './AccessTokenWishlistRestrictionField.svelte';
	import { WISHLIST_RESTRICTION, type WishlistRestriction } from './access_token_form.js';
	import type { OauthConsentView } from '$lib/modules/access_tokens/types.js';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';

	interface OauthConsentFormProps {
		consent: OauthConsentView;
		/** The provider's signed query, posted back with the decision. */
		oauthQuery: string;
		accountEmail: string;
	}

	const DENY_ACTION = '?/deny';

	let { consent, oauthQuery, accountEmail }: OauthConsentFormProps = $props();

	let selectedScopes = $state(untrack(() => consent.selectedScopes));
	let restriction = $state<WishlistRestriction>(
		untrack(() =>
			consent.wishlistIds === null ? WISHLIST_RESTRICTION.all : WISHLIST_RESTRICTION.some,
		),
	);
	let selectedWishlistIds = $state(untrack(() => consent.wishlistIds ?? []));
	let wishlistSearch = $state('');
	let wishlistsError = $state(false);
	let submitting = $state(false);

	function handleSubmit(event: SubmitEvent) {
		const denying = event.submitter?.getAttribute('formaction') === DENY_ACTION;
		if (
			!denying &&
			restriction === WISHLIST_RESTRICTION.some &&
			selectedWishlistIds.length === 0
		) {
			event.preventDefault();
			wishlistsError = true;
			return;
		}
		submitting = true;
	}
</script>

<!-- A native POST: the decision answers with a redirect to the app, which the browser follows. -->
<form method="POST" action="?/accept" class="flex flex-col gap-5.5" onsubmit={handleSubmit}>
	<input type="hidden" name="oauth_query" value={oauthQuery} />
	{#each selectedScopes as scope (scope)}
		<input type="hidden" name="scope" value={scope} />
	{/each}
	<input type="hidden" name="restriction" value={restriction} />
	{#if restriction === WISHLIST_RESTRICTION.some}
		{#each selectedWishlistIds as wishlistId (wishlistId)}
			<input type="hidden" name="wishlistId" value={wishlistId} />
		{/each}
	{/if}

	<ul class="consent-facts">
		{#if consent.client.verifiedHost === null}
			<li class="is-warning">
				<TriangleAlertIcon aria-hidden="true" />
				<span>{m.oauth_consent_unverified()}</span>
			</li>
		{:else}
			<li class="is-verified">
				<ShieldCheckIcon aria-hidden="true" />
				<span>
					{m.oauth_consent_verified_host()}
					<code>{consent.client.verifiedHost}</code>
				</span>
			</li>
		{/if}
		<li>
			<CornerDownLeftIcon aria-hidden="true" />
			<span>{m.oauth_consent_return_host({ host: consent.redirectHost })}</span>
		</li>
		<li>
			<UserRoundIcon aria-hidden="true" />
			<span>{m.oauth_consent_account({ email: accountEmail })}</span>
		</li>
	</ul>

	<ScopePicker
		bind:selected={selectedScopes}
		offered={consent.requestedScopes}
		label={m.oauth_consent_scopes_label()}
		disabled={submitting}
	/>

	<AccessTokenWishlistRestrictionField
		bind:restriction
		bind:selectedWishlistIds
		bind:wishlistSearch
		bind:wishlistsError
	/>

	<p class="text-(length:--text-sm) text-muted-foreground">{m.oauth_consent_review_note()}</p>

	<div class="consent-actions">
		<Button
			type="submit"
			formaction={DENY_ACTION}
			intent="secondary"
			size="lg"
			disabled={submitting}
		>
			{m.oauth_consent_deny()}
		</Button>
		<Button type="submit" size="lg" disabled={submitting}>
			{m.oauth_consent_allow()}
		</Button>
	</div>
</form>

<style>
	.consent-facts {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: var(--text-md);
	}

	.consent-facts li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.consent-facts li :global(svg) {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-top: 2px;
		color: var(--muted-foreground);
	}

	.consent-facts li.is-verified :global(svg) {
		color: var(--status-success-text);
	}

	.consent-facts li.is-warning {
		font-weight: 600;
		color: var(--status-warning-text);
	}

	.consent-facts li.is-warning :global(svg) {
		color: currentcolor;
	}

	.consent-facts code {
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--muted);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.consent-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
</style>
