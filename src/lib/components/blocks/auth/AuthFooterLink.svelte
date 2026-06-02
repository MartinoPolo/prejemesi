<script lang="ts">
	interface AuthFooterLinkProps {
		promptText: string;
		linkHref: string;
		linkText: string;
	}

	let { promptText, linkHref, linkText }: AuthFooterLinkProps = $props();
</script>

<div class="auth-footer">
	{promptText}&ensp;<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
		href={linkHref}>{linkText}</a
	>
</div>

<style>
	.auth-footer {
		text-align: center;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.auth-footer a {
		color: var(--primary);
		text-decoration: none;
		font-weight: var(--weight-semibold);
	}

	.auth-footer a:hover {
		text-decoration: underline;
	}
</style>
