<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Field } from '$lib/components/derived/field/index.js';

	interface AuthFormFieldProps {
		fieldId: string;
		label: string;
		errorMessage?: string;
		children: Snippet;
	}

	let { fieldId, label, errorMessage, children: control }: AuthFormFieldProps = $props();
</script>

<!-- Thin wrapper over the shared Field: auth consumers wire the control's a11y props
     themselves, so the control slot's context is unused here. -->
<Field {fieldId} {label} {errorMessage} children={control} />
