<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { copyFieldVariants, type CopyFieldProps } from './copy_field_variants.js';

	const COPIED_LABEL_DURATION_MILLISECONDS = 2000;

	let {
		value,
		displayValue = value,
		kind = 'text',
		size,
		id,
		label,
		oncopied,
	}: CopyFieldProps = $props();

	let copiedLabelShown = $state(false);
	let input = $state<HTMLInputElement | null>(null);
	let copyButton = $state<HTMLElement | null>(null);

	const styles = $derived(copyFieldVariants({ kind }));

	async function copyValue() {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			// Without clipboard access, select the value so the user can copy it by hand.
			input?.select();
			return;
		}
		copiedLabelShown = true;
		oncopied?.();
	}

	export function focusCopyButton() {
		copyButton?.focus();
	}

	$effect(() => {
		if (!copiedLabelShown) {
			return;
		}
		const timer = setTimeout(() => {
			copiedLabelShown = false;
		}, COPIED_LABEL_DURATION_MILLISECONDS);
		return () => clearTimeout(timer);
	});
</script>

<InputGroup.Root {size} class={styles.root()} data-slot="copy-field">
	<InputGroup.Input
		bind:ref={input}
		{id}
		value={displayValue}
		readonly
		spellcheck={false}
		autocomplete="off"
		aria-label={label}
		class={styles.input()}
		onclick={(event) => event.currentTarget.select()}
	/>
	<InputGroup.Segment
		bind:ref={copyButton}
		state={copiedLabelShown ? 'success' : 'default'}
		class={styles.copyButton()}
		onclick={copyValue}
	>
		{#if copiedLabelShown}
			<CheckIcon aria-hidden="true" />
			<span class={styles.copyLabel()}>{m.copy_field_copied()}</span>
		{:else}
			<CopyIcon aria-hidden="true" />
			<span class={styles.copyLabel()}>{m.copy_field_copy()}</span>
		{/if}
	</InputGroup.Segment>
</InputGroup.Root>
<p class="sr-only" role="status">{copiedLabelShown ? m.copy_field_copied() : ''}</p>
