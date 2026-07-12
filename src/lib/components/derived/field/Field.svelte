<script lang="ts">
	import { Label } from '$lib/components/base/label/index.js';
	import { cn } from '$lib/utils.js';
	import { fieldVariants, type FieldProps } from './field_variants.js';
	import FieldError from './FieldError.svelte';

	let {
		ref = $bindable(null),
		fieldId,
		label,
		errorMessage,
		help,
		class: className,
		children,
		...restProps
	}: FieldProps = $props();

	const hasError = $derived(errorMessage !== undefined && errorMessage !== '');
	const errorId = $derived(hasError ? `${fieldId}-error` : undefined);
</script>

<div
	bind:this={ref}
	data-slot="field"
	data-invalid={hasError ? true : undefined}
	class={cn(fieldVariants(), className)}
	{...restProps}
>
	<Label for={fieldId}>{label}</Label>
	<!-- The control slot receives the a11y wiring so the consumer applies the same
	     error contract everywhere: state="error" + aria-invalid + aria-describedby. -->
	{@render children({ hasError, errorId })}
	{#if hasError}
		<FieldError id={errorId}>{errorMessage}</FieldError>
	{:else if help}
		{@render help()}
	{/if}
</div>
