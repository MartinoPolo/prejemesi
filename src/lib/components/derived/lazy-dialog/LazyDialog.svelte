<script lang="ts" generics="LoadedComponent extends AnyComponent">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Spinner } from '$lib/components/base/spinner/index.js';
	import type { AnyComponent, LazyComponent } from './lazy_component.svelte.js';
	import { idlePreloadQueue } from './idle_preload_queue.js';

	/** The loaded dialog's open state; bind the dialog to `open` so closing it closes the host. */
	interface LazyDialogState {
		open: boolean;
	}

	interface LazyDialogProps {
		/** Opening starts the import; the error dialog's Escape and close set it back to false. */
		open: boolean;
		loader: LazyComponent<LoadedComponent>;
		/** Renders the loaded dialog, which then stays mounted so it can animate closed. */
		children: Snippet<[LoadedComponent, LazyDialogState]>;
		loadingLabel?: string;
		/** Imports in an idle period so a likely first open is instant. */
		preloadWhenIdle?: boolean;
		reloadPage?: () => void;
	}

	let {
		open = $bindable(false),
		loader,
		children,
		loadingLabel = m.dialog_loading(),
		preloadWhenIdle = false,
		reloadPage = () => window.location.reload(),
	}: LazyDialogProps = $props();

	let loading = $state(false);
	let loadFailed = $state(false);
	// Bits UI ignores the first `open` value it sees, so the loaded dialog renders closed for a
	// frame before it follows `open`; otherwise a first open would skip its animation and focus.
	let loadedDialogReady = $state(false);
	let loadedDialogOpen = $state(false);
	let retryButton = $state<HTMLElement | null>(null);

	const loadedDialogState: LazyDialogState = {
		get open() {
			return loadedDialogOpen;
		},
		set open(nextOpen) {
			loadedDialogOpen = nextOpen;
			open = nextOpen;
		},
	};

	const showLoading = $derived(open && loading && loader.component === undefined);
	const showLoadError = $derived(open && loadFailed && loader.component === undefined);

	async function load(): Promise<void> {
		loading = true;
		try {
			await loader.load();
		} catch (error) {
			console.error('[LazyDialog] lazy chunk failed to load', error);
			loadFailed = open;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!open) {
			loadFailed = false;
		}
	});

	$effect(() => {
		if (open && loader.component === undefined && !loading && !loadFailed) {
			void load();
		}
	});

	$effect(() => {
		if (loader.component === undefined) {
			return;
		}
		const frame = requestAnimationFrame(() => (loadedDialogReady = true));
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (loadedDialogReady) {
			loadedDialogOpen = open;
		}
	});

	$effect(() => {
		if (preloadWhenIdle) {
			return idlePreloadQueue.add(loader);
		}
	});
</script>

<p class="sr-only" role="status">{showLoading ? loadingLabel : ''}</p>

{#if loader.component !== undefined}
	{@render children(loader.component, loadedDialogState)}
{:else if showLoading}
	<div
		class="fixed inset-0 z-(--z-modal) grid place-items-center bg-black/20 p-4"
		aria-hidden="true"
	>
		<div class="bg-background flex items-center gap-2 rounded-lg border px-6 py-4 shadow-lg">
			<Spinner />
			{loadingLabel}
		</div>
	</div>
{/if}

<Dialog.Root
	open={showLoadError}
	onOpenChange={(nextOpen: boolean) => {
		if (!nextOpen) {
			open = false;
		}
	}}
>
	<Dialog.Content
		size="md"
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			retryButton?.focus();
		}}
	>
		<Dialog.Header>
			<Dialog.Title>{m.dialog_load_error_title()}</Dialog.Title>
			<Dialog.Description>{m.error_generic()}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button intent="outline" onclick={reloadPage}>{m.dialog_reload()}</Button>
			<Button bind:ref={retryButton} onclick={() => (loadFailed = false)}>
				{m.dialog_retry()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
