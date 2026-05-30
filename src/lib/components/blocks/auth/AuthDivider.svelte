<script lang="ts">
	interface AuthDividerProps {
		label?: string;
	}

	let { label = 'nebo' }: AuthDividerProps = $props();
</script>

<div class="auth-divider">
	<div class="auth-divider-line"></div>
	<span class="auth-divider-text">{label}</span>
	<div class="auth-divider-line"></div>
</div>

<style>
	.auth-divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-5) 0;
	}

	.auth-divider-line {
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	.auth-divider-text {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
		white-space: nowrap;
		letter-spacing: var(--tracking-wide);
	}
</style>
