<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface AuthDividerProps {
		label?: string;
	}

	let { label }: AuthDividerProps = $props();
</script>

<div class="auth-divider">
	<div class="auth-divider-line"></div>
	<!-- Resolved in the markup, not as a prop default, so the label follows a locale switch. -->
	<span class="auth-divider-text">{label ?? m.auth_divider_or()}</span>
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
		color: var(--muted-foreground);
		white-space: nowrap;
		letter-spacing: 0.08em;
	}
</style>
