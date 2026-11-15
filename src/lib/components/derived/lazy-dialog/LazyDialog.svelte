<script lang="ts" generics="LoadedComponent extends AnyComponent">
	import type { Snippet } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { AnyComponent, LazyComponent } from './lazy_component.svelte.js';

	const IDLE_PRELOAD_TIMEOUT_MILLISECONDS = 3_000;

	interface LazyDialogProps {
		/** Opening starts the import. */
		open: boolean;
		loader: LazyComponent<LoadedComponent>;
		/** Renders the loaded dialog, which then stays mounted so it can animate closed. */
		children: Snippet<[LoadedComponent]>;
		loadingLabel?: string;
		/** Imports during idle time so a likely first open is instant. */
		preloadWhenIdle?: boolean;
		reloadPage?: () => void;
	}

	let {
		open,
		loader,
		children,
		loadingLabel = m.dialog_loading(),
		preloadWhenIdle = false,
		reloadPage = () => window.location.reload(),
	}: LazyDialogProps = $props();

	let loading = false;
	let loadFailed = $state(false);

	async function load(): Promise<void> {
		loading = true;
		try {
			await loader.load();
		} catch (error) {
			console.error('[LazyDialog] lazy chunk failed to load', error);
			loadFailed = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!open || loader.component !== undefined || loading || loadFailed) {
			return;
		}
		void load();
	});

	$effect(() => {
		if (!preloadWhenIdle || loader.component !== undefined) {
			return;
		}
		if (typeof window.requestIdleCallback === 'function') {
			const idleHandle = window.requestIdleCallback(loader.preload, {
				timeout: IDLE_PRELOAD_TIMEOUT_MILLISECONDS,
			});
			return () => window.cancelIdleCallback(idleHandle);
		}
		// Safari has no requestIdleCallback — fall back to a bounded timer.
		const timeoutHandle = setTimeout(loader.preload, IDLE_PRELOAD_TIMEOUT_MILLISECONDS);
		return () => clearTimeout(timeoutHandle);
	});
</script>

{#if loader.component !== undefined}
	{@render children(loader.component)}
{:else if open}
	<div class="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4">
		{#if loadFailed}
			<div
				class="bg-background grid gap-3 rounded-lg border px-6 py-4 shadow-lg"
				role="alert"
			>
				<p>{m.error_generic()}</p>
				<div class="flex gap-(--nested-control-gap)">
					<Button size="sm" onclick={() => (loadFailed = false)}>
						{m.import_wizard_retry()}
					</Button>
					<Button size="sm" intent="outline" onclick={reloadPage}>
						{m.import_wizard_reload()}
					</Button>
				</div>
			</div>
		{:else}
			<div
				class="bg-background rounded-lg border px-6 py-4 shadow-lg"
				role="status"
				aria-live="polite"
				aria-label={loadingLabel}
			>
				{loadingLabel}
			</div>
		{/if}
	</div>
{/if}
