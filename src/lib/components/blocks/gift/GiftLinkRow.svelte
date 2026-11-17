<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { GiftLink } from '$lib/modules/gifts/types.js';
	import { extractGiftUrlDomain } from '$lib/modules/gifts/gift_url.js';
	import { cn } from '$lib/utils.js';
	import { giftLinkLine } from './gift_link_line.js';
	import { giftLinkEditorVariants } from './gift_link_editor_variants.js';

	interface GiftLinkRowProps {
		link: GiftLink;
		/** Reorder target key; the editor finds the row and its grip through it. */
		rowKey: string;
		/** 1-based place in the list; the first link is the primary one. */
		position: number;
		isExpanded: boolean;
		canReorder: boolean;
		urlError?: string;
		disabled?: boolean;
		ontoggle: () => void;
		oncollapse: () => void;
		onurlchange: (url: string) => void;
		onlabelchange: (label: string) => void;
		onremove: () => void;
		ongrippointerdown: (event: PointerEvent) => void;
		ongripkeydown: (event: KeyboardEvent) => void;
	}

	let {
		link,
		rowKey,
		position,
		isExpanded,
		canReorder,
		urlError,
		disabled = false,
		ontoggle,
		oncollapse,
		onurlchange,
		onlabelchange,
		onremove,
		ongrippointerdown,
		ongripkeydown,
	}: GiftLinkRowProps = $props();

	const styles = giftLinkEditorVariants();
	const rowId = $props.id();
	const panelId = `${rowId}-panel`;
	const urlInputId = `${rowId}-url`;
	const labelInputId = `${rowId}-label`;
	const urlErrorId = `${rowId}-url-error`;
	const primaryHintId = `${rowId}-primary`;

	let rowElement = $state<HTMLLIElement | null>(null);
	let toggleElement = $state<HTMLButtonElement | null>(null);

	const isPrimary = $derived(position === 1);
	const line = $derived(giftLinkLine(link));
	const hasUrlError = $derived(urlError != null && urlError !== '');
	const linkDomain = $derived(extractGiftUrlDomain(link.url));
	// Previews the label an empty field falls back to, so the placeholder shows what renders.
	const labelPlaceholder = $derived(linkDomain ?? m.gift_link_label_placeholder());
	// The sr-only primacy hint stays wired to the controls so focus mode announces it too.
	const describedBy = $derived(
		[isPrimary ? primaryHintId : undefined, hasUrlError ? urlErrorId : undefined]
			.filter((id) => id !== undefined)
			.join(' ') || undefined,
	);

	// Only the open panel is a layer of its own: Escape on the row line belongs to the dialog.
	function collapseAndRefocus(event: KeyboardEvent) {
		if (event.key !== 'Escape') {
			return;
		}
		// Captured so the dialog around the editor never treats this Escape as dismissal.
		event.preventDefault();
		event.stopPropagation();
		oncollapse();
		toggleElement?.focus();
	}

	function handleFocusOut(event: FocusEvent) {
		if (!isExpanded) {
			return;
		}
		if (
			event.relatedTarget instanceof Node &&
			rowElement?.contains(event.relatedTarget) === true
		) {
			return;
		}
		// Settle first: a keyboard reorder re-focuses the moved grip, leaving the window (to copy
		// a link elsewhere) should find the row still open on return, and a press inside the row
		// that does not focus (Safari buttons) is the row's own toggle, not a click away.
		requestAnimationFrame(() => {
			if (
				!isExpanded ||
				!document.hasFocus() ||
				rowElement === null ||
				rowElement.contains(document.activeElement) ||
				rowElement.matches(':active')
			) {
				return;
			}
			oncollapse();
		});
	}
</script>

{#snippet leadingControl()}
	{#if canReorder}
		<button
			type="button"
			class={cn(styles.leadingColumn(), styles.grip())}
			aria-label={m.gift_link_move_label({ position })}
			title={m.gift_link_move_hint()}
			aria-keyshortcuts="ArrowUp ArrowDown"
			aria-disabled={disabled}
			data-gift-link-grip
			onpointerdown={ongrippointerdown}
			onkeydown={ongripkeydown}
		>
			<GripVerticalIcon aria-hidden="true" />
		</button>
	{:else}
		<span class={styles.leadingColumn()} aria-hidden="true"></span>
	{/if}
{/snippet}

{#snippet lineText()}
	{#if line.kind === 'labelled'}
		<span class={styles.chip()}>{line.label}</span>
	{/if}
	<span class={styles.address()} data-invalid={hasUrlError ? '' : undefined}>
		{#if line.kind === 'highlighted'}
			{line.beforeLabel}<mark class={styles.highlight()}>{line.label}</mark>{line.afterLabel}
		{:else}
			{line.address}
		{/if}
	</span>
	<span class="sr-only">{m.gift_link_edit()}</span>
	<span class={styles.editIcon()} aria-hidden="true">
		{#if isExpanded}
			<ChevronUpIcon />
		{:else}
			<PencilIcon />
		{/if}
	</span>
{/snippet}

{#snippet editPanel()}
	<div
		id={panelId}
		class={styles.panel()}
		data-testid="gift-link-panel"
		onkeydowncapture={collapseAndRefocus}
	>
		<div class={styles.field()}>
			<Label for={urlInputId}>{m.gift_link_address()}</Label>
			<Input
				id={urlInputId}
				value={link.url}
				placeholder="alza.cz/darek"
				type="text"
				inputmode="url"
				autocomplete="off"
				data-testid="gift-link-url"
				{disabled}
				state={hasUrlError ? 'error' : 'default'}
				aria-invalid={hasUrlError ? true : undefined}
				aria-describedby={describedBy}
				oninput={(event: Event & { currentTarget: HTMLInputElement }) =>
					onurlchange(event.currentTarget.value)}
			/>
		</div>
		<div class={styles.labelAndRemove()}>
			<div class={styles.field()}>
				<div class={styles.fieldHeading()}>
					<Label for={labelInputId}>{m.gift_link_visible_label()}</Label>
					{#if linkDomain !== null}
						<span class={styles.fieldAside()} aria-hidden="true">
							{m.gift_link_label_default_hint({ domain: linkDomain })}
						</span>
					{/if}
				</div>
				<Input
					id={labelInputId}
					value={link.label ?? ''}
					placeholder={labelPlaceholder}
					type="text"
					{disabled}
					oninput={(event: Event & { currentTarget: HTMLInputElement }) =>
						onlabelchange(event.currentTarget.value)}
				/>
			</div>
			<Button intent="ghost-danger-quiet" {disabled} onclick={onremove}>
				<TrashIcon data-icon="inline-start" />
				{m.gift_link_remove()}
			</Button>
		</div>
	</div>
{/snippet}

<li
	bind:this={rowElement}
	class={styles.row()}
	data-gift-link-row={rowKey}
	data-expanded={isExpanded ? '' : undefined}
	onfocusout={handleFocusOut}
>
	{#if isPrimary}
		<span id={primaryHintId} class="sr-only">{m.gift_link_primary()}</span>
	{/if}
	<div class={styles.line()}>
		{@render leadingControl()}
		<button
			bind:this={toggleElement}
			type="button"
			class={styles.toggle()}
			aria-expanded={isExpanded}
			aria-controls={isExpanded ? panelId : undefined}
			aria-describedby={describedBy}
			data-gift-link-toggle
			{disabled}
			onclick={ontoggle}
		>
			{@render lineText()}
		</button>
	</div>

	{#if isExpanded}
		{@render editPanel()}
	{/if}

	{#if hasUrlError}
		<HelpText id={urlErrorId} state="error" class={styles.rowError()}>{urlError}</HelpText>
	{/if}
</li>
