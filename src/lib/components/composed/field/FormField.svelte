<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { HTMLInputTypeAttribute } from 'svelte/elements';

	interface Props {
		id: string;
		label: string;
		placeholder?: string;
		type?: HTMLInputTypeAttribute;
		multiline?: boolean;
		value?: string;
		class?: string;
	}

	let {
		id,
		label: labelText,
		placeholder,
		type = 'text',
		multiline = false,
		value = $bindable(''),
		class: className,
	}: Props = $props();
</script>

<div class="space-y-2 {className ?? ''}">
	<Label for={id}>{labelText}</Label>
	{#if multiline}
		<Textarea {id} {placeholder} bind:value />
	{:else}
		<Input {id} {type} {placeholder} bind:value />
	{/if}
</div>
