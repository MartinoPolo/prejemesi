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
		border-top: 2px dashed var(--ink-faint);
	}

	.auth-divider-text {
		font-size: var(--text-xs);
		font-weight: 800;
		text-transform: uppercase;
		color: var(--ink-soft);
		white-space: nowrap;
		letter-spacing: 0.08em;
	}
</style>
