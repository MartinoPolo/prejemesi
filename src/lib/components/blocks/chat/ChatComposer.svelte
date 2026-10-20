<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import SquareIcon from '@lucide/svelte/icons/square';
	import { Button } from '$lib/components/base/button/index.js';

	/** The message box: Enter sends, Shift+Enter starts a new line, Zastavit ends a streaming answer. */
	let {
		value = $bindable(''),
		streaming,
		disabled,
		textarea = $bindable(),
		onsend,
		onstop,
	}: {
		value?: string;
		streaming: boolean;
		/** The cap or the kill switch: the status line above says why. */
		disabled: boolean;
		textarea?: HTMLTextAreaElement;
		onsend: (text: string) => void;
		onstop: () => void;
	} = $props();

	const canSend = $derived(!disabled && !streaming && value.trim() !== '');

	function send(event?: SubmitEvent) {
		event?.preventDefault();
		if (canSend) {
			onsend(value.trim());
			// Send swaps for Zastavit, so focus stays in the panel for Escape and the next message.
			textarea?.focus();
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			send();
		}
	}
</script>

<form class={['composer', disabled && 'is-disabled']} onsubmit={send}>
	<label class="sr-only" for="assistant-composer">{m.chat_composer_label()}</label>
	<textarea
		id="assistant-composer"
		bind:this={textarea}
		bind:value
		rows="1"
		placeholder={m.chat_composer_placeholder()}
		{disabled}
		data-testid="assistant-composer"
		{onkeydown}
	></textarea>
	{#if streaming}
		<Button
			intent="secondary"
			size="md"
			data-testid="assistant-stop"
			onclick={() => {
				onstop();
				textarea?.focus();
			}}
		>
			<SquareIcon data-icon="inline-start" />{m.chat_stop()}
		</Button>
	{:else}
		<Button
			type="submit"
			size="md"
			format="icon"
			aria-label={m.chat_send()}
			disabled={!canSend}
			data-testid="assistant-send"
		>
			<ArrowUpIcon />
		</Button>
	{/if}
</form>

<style>
	/* 16px panel corner, 2px border, 12px gutter: inner corners follow at 12px - 2px = 10px. */
	.composer {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		padding: 6px;
		border: 2px solid var(--ink);
		border-radius: 12px;
		background: var(--card);
	}

	.composer:focus-within {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.composer.is-disabled {
		background: var(--muted);
	}

	textarea {
		flex: 1;
		min-width: 0;
		max-height: 160px;
		padding: 6px var(--space-2);
		border: 0;
		background: transparent;
		font: inherit;
		font-size: var(--text-md);
		line-height: 1.4;
		resize: none;
		field-sizing: content;
		outline: none;
	}

	textarea::placeholder {
		color: var(--muted-foreground);
	}
</style>
