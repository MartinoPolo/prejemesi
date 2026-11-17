<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { LiveAnnouncement } from '$lib/reactivity/live_announcement.svelte.js';
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Kbd } from '$lib/components/base/kbd/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { createGiftPointerReorderController } from '$lib/components/blocks/wishlist/gift_pointer_reorder.svelte.js';
	import LinkIcon from '@lucide/svelte/icons/link';
	import GiftLinkRow from './GiftLinkRow.svelte';
	import { giftLinkEditorVariants } from './gift_link_editor_variants.js';
	import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';
	import {
		canonicalGiftLinkKey,
		createGiftLinkId,
		normalizeGiftUrl,
	} from '$lib/modules/gifts/gift_url.js';

	interface GiftLinkEditorProps {
		links: GiftLink[];
		maxLinks?: number;
		disabled?: boolean;
		onlinkschange: (links: GiftLink[]) => void;
	}

	let {
		links,
		maxLinks = MAX_GIFT_LINKS,
		disabled = false,
		onlinkschange,
	}: GiftLinkEditorProps = $props();

	const styles = giftLinkEditorVariants();
	const editorId = $props.id();
	const headingId = `${editorId}-heading`;
	const pasteInputId = `${editorId}-paste`;
	const pasteLabelId = `${editorId}-paste-label`;
	const pasteErrorId = `${editorId}-paste-error`;

	let listElement = $state<HTMLUListElement | null>(null);
	let pasteInput = $state<HTMLInputElement | null>(null);
	let expandedKey = $state<string | null>(null);
	let pasteDraft = $state('');
	let pasteError = $state<string | null>(null);
	const announcement = new LiveAnnouncement();
	/** The link a pointer drag or arrow key is moving, announced once it lands. */
	let movingKey: string | null = null;

	const isAtCap = $derived(links.length >= maxLinks);
	const canReorder = $derived(links.length > 1 && !disabled);

	const reorder = createGiftPointerReorderController({
		getItemElements: () =>
			listElement === null
				? []
				: Array.from(
						listElement.querySelectorAll<HTMLElement>(':scope > [data-gift-link-row]'),
					),
		getItemIds: () => links.map(linkKey),
		onPreviewOrder: applyOrder,
		onCommitOrder: (orderedKeys) => {
			applyOrder(orderedKeys);
			announceMove(orderedKeys);
		},
		onCancelOrder: applyOrder,
	});
	onDestroy(() => reorder.destroy());

	/** `ensureGiftLinkIds` gives every editor link an id; the index only covers an id-less caller. */
	function linkKey(link: GiftLink, index: number): string {
		return link.id ?? `gift-link-index-${index}`;
	}

	function applyOrder(orderedKeys: readonly string[]) {
		const linksByKey = new Map(links.map((link, index) => [linkKey(link, index), link]));
		const ordered = orderedKeys
			.map((key) => linksByKey.get(key))
			.filter((link) => link !== undefined);
		if (ordered.length === links.length) {
			onlinkschange(ordered);
		}
	}

	function announceMove(orderedKeys: readonly string[]) {
		const position = orderedKeys.indexOf(movingKey ?? '') + 1;
		movingKey = null;
		if (position === 0) {
			return;
		}
		const count = orderedKeys.length;
		void announcement.announce(
			position === 1
				? m.gift_link_moved_primary({ count })
				: m.gift_link_moved({ position, count }),
		);
	}

	function rowElement(key: string): HTMLElement | null {
		return (
			listElement?.querySelector<HTMLElement>(
				`:scope > [data-gift-link-row="${CSS.escape(key)}"]`,
			) ?? null
		);
	}

	function handleGripPointerDown(event: PointerEvent, index: number) {
		if (disabled) {
			return;
		}
		movingKey = linkKey(links[index]!, index);
		reorder.start(event, index);
	}

	async function handleGripKeydown(event: KeyboardEvent, index: number) {
		const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (direction === 0 || disabled) {
			return;
		}
		event.preventDefault();
		const key = linkKey(links[index]!, index);
		movingKey = key;
		if (!reorder.move(index, direction)) {
			movingKey = null;
			return;
		}
		await tick();
		rowElement(key)?.querySelector<HTMLElement>('[data-gift-link-grip]')?.focus();
	}

	/**
	 * Opens one row at a time. A row left without an address is dropped as it closes: saving would
	 * discard it anyway, and an empty line would show nothing to click.
	 */
	function expand(key: string | null) {
		const previousKey = expandedKey;
		expandedKey = key;
		if (previousKey === null || previousKey === key) {
			return;
		}
		const remaining = links.filter(
			(link, index) => linkKey(link, index) !== previousKey || link.url.trim() !== '',
		);
		if (remaining.length !== links.length) {
			onlinkschange(remaining);
		}
	}

	function collapse(key: string) {
		if (expandedKey === key) {
			expand(null);
		}
	}

	async function removeLink(index: number) {
		const removedKey = linkKey(links[index]!, index);
		if (expandedKey === removedKey) {
			expandedKey = null;
		}
		onlinkschange(links.filter((_, linkIndex) => linkIndex !== index));
		await tick();
		const nextLink = links[index] ?? links[index - 1];
		const nextFocus =
			nextLink === undefined
				? pasteInput
				: rowElement(
						linkKey(nextLink, links.indexOf(nextLink)),
					)?.querySelector<HTMLElement>('[data-gift-link-toggle]');
		nextFocus?.focus();
	}

	function updateLink(index: number, change: Partial<GiftLink>) {
		const updated = [...links];
		updated[index] = { ...updated[index]!, ...change };
		onlinkschange(updated);
	}

	function urlError(url: string): string | undefined {
		if (url.trim() === '') {
			return undefined;
		}
		if (normalizeGiftUrl(url) === null) {
			return m.draft_grid_link_url_invalid();
		}
		return undefined;
	}

	/** Adds the text as a new link, or explains in the paste field why it cannot. */
	function addLinkFromText(text: string): boolean {
		const url = text.trim();
		if (url === '' || isAtCap || disabled) {
			return false;
		}
		const canonicalKey = canonicalGiftLinkKey(url);
		if (canonicalKey === null) {
			pasteError = m.gift_link_invalid_url();
			return false;
		}
		if (links.some((link) => canonicalGiftLinkKey(link.url) === canonicalKey)) {
			pasteError = m.gift_link_duplicate_url();
			return false;
		}
		onlinkschange([...links, { url, id: createGiftLinkId() }]);
		pasteDraft = '';
		pasteError = null;
		void announcement.announce(m.gift_link_added());
		return true;
	}

	/** Pasting into the empty field is the whole add flow; pasting into typed text only edits it. */
	function handlePaste(event: ClipboardEvent) {
		if (pasteDraft.trim() !== '') {
			return;
		}
		const pasted = event.clipboardData?.getData('text') ?? '';
		if (addLinkFromText(pasted)) {
			event.preventDefault();
		}
	}

	function handlePasteKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || pasteDraft.trim() === '') {
			return;
		}
		// Keeps Enter from submitting the gift form around the editor.
		event.preventDefault();
		addLinkFromText(pasteDraft);
	}

	function handlePasteBlur() {
		if (pasteDraft.trim() !== '') {
			addLinkFromText(pasteDraft);
		}
	}
</script>

<svelte:window onkeydowncapture={reorder.cancelOnEscape} />

<div class={styles.root()} data-testid="gift-link-editor">
	<div class={styles.heading()}>
		<Label id={headingId} for={pasteInputId}>{m.gift_url_label()}</Label>
		<span class={styles.counter()}>
			{m.gift_link_counter({ current: links.length, max: maxLinks })}
		</span>
	</div>

	<div class={styles.box()}>
		<!-- An explicit role, because Safari drops the list semantics of a list-none list. -->
		<ul class={styles.list()} role="list" aria-labelledby={headingId} bind:this={listElement}>
			{#each links as link, index (linkKey(link, index))}
				{@const key = linkKey(link, index)}
				<GiftLinkRow
					{link}
					rowKey={key}
					position={index + 1}
					isExpanded={expandedKey === key}
					{canReorder}
					urlError={urlError(link.url)}
					{disabled}
					ontoggle={() => expand(expandedKey === key ? null : key)}
					oncollapse={() => collapse(key)}
					onurlchange={(url: string) => updateLink(index, { url })}
					onlabelchange={(label: string) =>
						updateLink(index, { label: label === '' ? undefined : label })}
					onremove={() => void removeLink(index)}
					ongrippointerdown={(event: PointerEvent) => handleGripPointerDown(event, index)}
					ongripkeydown={(event: KeyboardEvent) => void handleGripKeydown(event, index)}
				/>
			{/each}
		</ul>
		<div class={styles.paste()}>
			<span class={styles.leadingColumn()} aria-hidden="true"><LinkIcon /></span>
			<span id={pasteLabelId} class="sr-only">{m.gift_link_paste_label()}</span>
			<input
				bind:this={pasteInput}
				bind:value={pasteDraft}
				id={pasteInputId}
				class={styles.pasteInput()}
				type="text"
				inputmode="url"
				autocomplete="off"
				placeholder={isAtCap ? m.gift_link_max_reached() : m.gift_link_paste_placeholder()}
				aria-labelledby="{headingId} {pasteLabelId}"
				aria-invalid={pasteError !== null ? true : undefined}
				aria-describedby={pasteError !== null ? pasteErrorId : undefined}
				disabled={isAtCap || disabled}
				data-testid="gift-link-paste"
				oninput={() => (pasteError = null)}
				onpaste={handlePaste}
				onkeydown={handlePasteKeydown}
				onblur={handlePasteBlur}
			/>
			<Kbd class={styles.pasteShortcut()} aria-hidden="true"
				>{m.gift_link_paste_shortcut()}</Kbd
			>
		</div>
	</div>

	{#if pasteError !== null}
		<HelpText id={pasteErrorId} state="error">{pasteError}</HelpText>
	{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement.current}</p>
</div>
