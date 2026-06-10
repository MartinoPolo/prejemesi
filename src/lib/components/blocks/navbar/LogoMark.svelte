<script lang="ts">
	import { resolve } from '$app/paths';
	import GiftIcon from '@lucide/svelte/icons/gift';
</script>

<a class="logo" href={resolve('/')} aria-label="Přejeme si — domovska stranka">
	<span class="logo-icon-wrap" aria-hidden="true">
		<GiftIcon class="size-[18px]" />
	</span>
	<span class="logo-text">
		prejemesi<span class="logo-tld">.cz</span>
	</span>
</a>

<style>
	.logo {
		font-family: var(--font-heading);
		font-weight: var(--weight-bold);
		font-size: var(--text-xl);
		color: var(--primary);
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
		background: oklch(from var(--primary) l c h / 12%);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--primary);
		flex-shrink: 0;
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
