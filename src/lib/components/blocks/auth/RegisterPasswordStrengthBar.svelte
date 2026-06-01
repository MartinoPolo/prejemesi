<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface RegisterPasswordStrengthBarProps {
		password: string;
	}

	let { password }: RegisterPasswordStrengthBarProps = $props();

	let strength = $derived.by(() => {
		if (!password) {
			return 0;
		}
		let score = 0;
		if (password.length >= 8) {
			score++;
		}
		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
			score++;
		}
		if (/\d/.test(password)) {
			score++;
		}
		if (/[^a-zA-Z0-9]/.test(password)) {
			score++;
		}
		return score;
	});

	let label = $derived.by(() => {
		if (!password) {
			return '';
		}
		if (strength <= 1) {
			return m.register_strength_weak();
		}
		if (strength === 2) {
			return m.register_strength_fair();
		}
		if (strength === 3) {
			return m.register_strength_good();
		}
		return m.register_strength_strong();
	});

	let color = $derived.by(() => {
		if (strength <= 1) {
			return 'var(--destructive)';
		}
		if (strength === 2) {
			return 'var(--status-warning)';
		}
		return 'var(--status-success)';
	});
</script>

{#if password}
	<div class="strength-bar" role="progressbar" aria-label={m.register_strength_label({ label })}>
		{#each [0, 1, 2, 3] as index (index)}
			<div
				class="strength-segment"
				style:background={index < strength ? color : undefined}
			></div>
		{/each}
	</div>
	<span class="form-helper-text" style:color>{label}</span>
{/if}

<style>
	.strength-bar {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}

	.strength-segment {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: var(--border);
		transition: background var(--duration-normal);
	}

	.form-helper-text {
		font-size: var(--text-xs);
	}
</style>
