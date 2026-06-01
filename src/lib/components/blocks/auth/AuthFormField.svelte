<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '$lib/components/base/label/index.js';

	interface AuthFormFieldProps {
		fieldId: string;
		label: string;
		errorMessage?: string;
		children: Snippet;
	}

	let { fieldId, label, errorMessage, children }: AuthFormFieldProps = $props();

	let errorId = $derived(
		errorMessage !== undefined && errorMessage !== '' ? `${fieldId}-error` : undefined,
	);
</script>

<div class="form-field">
	<Label for={fieldId}>{label}</Label>
	{@render children()}
	{#if errorMessage}
		<span class="form-error-text" id={errorId}>{errorMessage}</span>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-error-text {
		font-size: var(--text-xs);
		color: var(--destructive);
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: var(--leading-snug);
	}
</style>
