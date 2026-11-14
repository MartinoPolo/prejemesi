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
		maxLines,
		onsend,
		onstop,
	}: {
		value?: string;
		streaming: boolean;
		/** The cap or the kill switch: the status line above says why. */
		disabled: boolean;
		textarea?: HTMLTextAreaElement;
		/** Lines the box grows to before it scrolls; follows the space above the keyboard. */
		maxLines?: number;
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
		class={[maxLines !== undefined && 'is-capped']}
		style:--composer-max-lines={maxLines}
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
		border: 2px solid var(--edge);
		border-radius: var(--chat-surface-radius);
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
		--composer-padding-block: 6px;

		flex: 1;
		min-width: 0;
		max-height: 160px;
		padding: var(--composer-padding-block) var(--space-2);
		border: 0;
		background: transparent;
		font: inherit;
		font-size: var(--text-md);
		line-height: 1.4;
		resize: none;
		field-sizing: content;
		outline: none;
	}

	textarea.is-capped {
		max-height: calc(var(--composer-max-lines) * 1.4em + 2 * var(--composer-padding-block));
	}

	textarea::placeholder {
		color: var(--muted-foreground);
	}

	/* iOS Safari zooms into fields set below 16px on focus. */
	@media (width < 640px) {
		textarea {
			font-size: 16px;
		}
	}
</style>
