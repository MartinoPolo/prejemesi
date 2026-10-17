<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { cn } from '$lib/utils.js';
	import {
		ACCESS_TOKEN_SCOPE_COPY,
		ACCESS_TOKEN_SCOPES,
		accessTokenExpiryPresetLabel,
		formatAccessTokenDate,
	} from '$lib/modules/access_tokens/access_token_display.js';
	import type { AccessTokenSummary } from '$lib/modules/access_tokens/index.js';

	interface AccessGrantDetailsProps {
		token: AccessTokenSummary;
		class?: string;
	}

	let { token, class: className }: AccessGrantDetailsProps = $props();

	const grantedScopes = $derived(
		ACCESS_TOKEN_SCOPES.filter((scope) => token.scopes.includes(scope)),
	);
	const expiryDetail = $derived(
		(token.expired
			? m.access_tokens_detail_expiry_expired
			: m.access_tokens_detail_expiry_active)({
			duration: accessTokenExpiryPresetLabel(token.expiryPresetDays),
			date: formatAccessTokenDate(token.expiresAt),
		}),
	);
</script>

<dl class={cn('access-grant-details text-(length:--text-sm)', className)}>
	<dt>{m.access_tokens_detail_scopes()}</dt>
	<dd>
		<ul class="flex flex-col gap-1">
			{#each grantedScopes as scope (scope)}
				<li class="flex flex-wrap items-center gap-1.5">
					<Badge>{ACCESS_TOKEN_SCOPE_COPY[scope].label()}</Badge>
					<code class="text-(length:--text-xs) text-muted-foreground">{scope}</code>
				</li>
			{/each}
		</ul>
	</dd>
	<dt>{m.access_tokens_detail_lists()}</dt>
	<dd>
		{token.wishlists === null
			? m.access_tokens_lists_option_all()
			: token.wishlists.map((wishlist) => wishlist.title).join(', ')}
	</dd>
	<dt>{m.access_tokens_fast_forward()}</dt>
	<dd>
		{token.fastForward
			? m.access_tokens_detail_fast_forward_on()
			: m.access_tokens_detail_fast_forward_off()}
	</dd>
	<dt>{m.access_tokens_expiry_label()}</dt>
	<dd>{expiryDetail}</dd>
</dl>

<style>
	.access-grant-details {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: var(--space-1);
	}

	.access-grant-details dt {
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.access-grant-details dd {
		min-width: 0;
		margin-bottom: var(--space-2);
		overflow-wrap: anywhere;
	}

	@media (width >= 640px) {
		.access-grant-details {
			grid-template-columns: max-content minmax(0, 1fr);
			gap: var(--space-2) var(--space-4);
		}

		.access-grant-details dd {
			margin-bottom: 0;
		}
	}
</style>
