<script lang="ts">
	import { resolve } from '$app/paths';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<a class="logo" href={localizeInternalHref(resolve('/'))} aria-label={m.logo_home_label()}>
	<span class="logo-icon-wrap" aria-hidden="true">
		<GiftIcon class="size-[18px]" />
	</span>
	<span class="logo-text">
		prejemesi<span class="logo-tld">.cz</span>
	</span>
</a>

<style>
	/* Mockup wordmark: ink text, tilted brand-gradient mark with an ink border. */
	.logo {
		font-family: var(--font-heading);
		font-weight: var(--weight-bold);
		font-size: var(--text-xl);
		color: var(--ink);
		letter-spacing: var(--tracking-tight);
		text-decoration: none;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.logo:hover {
		opacity: 0.85;
	}

	.logo-icon-wrap {
		width: 30px;
		height: 30px;
		background: linear-gradient(180deg, var(--brand), var(--brand-deep));
		border: 2px solid var(--ink);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		flex-shrink: 0;
		transform: rotate(-4deg);
	}

	.logo-text {
		display: flex;
		align-items: baseline;
		gap: 3px;
	}

	.logo-tld {
		opacity: 0.42;
		font-weight: var(--weight-medium);
		font-size: var(--text-lg);
	}
</style>
