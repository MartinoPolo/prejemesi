<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Input } from '$lib/components/base/input/index.js';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import * as m from '$lib/paraglide/messages.js';

	interface AuthPasswordInputProps {
		fieldId: string;
		value: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		placeholder?: string;
		hasError?: boolean;
		errorDescribedById?: string;
		disabled?: boolean;
		onblur?: () => void;
	}

	let {
		fieldId,
		value = $bindable(),
		autocomplete = 'current-password',
		placeholder,
		hasError = false,
		errorDescribedById,
		disabled = false,
		onblur,
	}: AuthPasswordInputProps = $props();

	let showPassword = $state(false);
</script>

<div class="password-wrapper">
	<Input
		id={fieldId}
		size="lg"
		type={showPassword ? 'text' : 'password'}
		{autocomplete}
		{placeholder}
		bind:value
		{onblur}
		aria-invalid={hasError ? true : undefined}
		aria-describedby={errorDescribedById}
		{disabled}
		state={hasError ? 'error' : 'default'}
		class="pr-11!"
	/>
	<button
		class="password-toggle"
		type="button"
		aria-label={showPassword ? m.hide_password() : m.show_password()}
		onclick={() => (showPassword = !showPassword)}
		tabindex={-1}
	>
		{#if showPassword}
			<EyeOffIcon class="size-4" />
		{:else}
			<EyeIcon class="size-4" />
		{/if}
	</button>
</div>

<style>
	.password-wrapper {
		position: relative;
	}

	.password-toggle {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast);
		line-height: 1;
	}

	.password-toggle:hover {
		color: var(--foreground);
	}
</style>
