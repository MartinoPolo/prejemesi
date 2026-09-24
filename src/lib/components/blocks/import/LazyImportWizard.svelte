<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ComponentProps } from 'svelte';
	import type ImportWizardComponent from './ImportWizard.svelte';

	type ImportWizardProps = ComponentProps<typeof ImportWizardComponent>;
	type ImportWizardLoader = () => Promise<{ default: typeof ImportWizardComponent }>;
	type LazyImportWizardProps = ImportWizardProps & {
		loadWizard?: ImportWizardLoader;
		reloadPage?: () => void;
	};

	let {
		open = $bindable(false),
		loadWizard = () => import('./ImportWizard.svelte'),
		reloadPage = () => window.location.reload(),
		...wizardProps
	}: LazyImportWizardProps = $props();

	let Wizard = $state<typeof ImportWizardComponent>();
	let loadStarted = false;
	let loadFailed = $state(false);

	async function load(): Promise<void> {
		loadStarted = true;
		loadFailed = false;
		try {
			Wizard = (await loadWizard()).default;
		} catch (error) {
			console.error('[ImportWizard] lazy chunk failed to load', error);
			loadStarted = false;
			loadFailed = true;
		}
	}

	$effect(() => {
		if (open !== true || Wizard !== undefined || loadStarted === true || loadFailed === true) {
			return;
		}
		void load();
	});
</script>

{#if open}
	{#if Wizard !== undefined}
		<Wizard bind:open {...wizardProps} />
	{:else}
		<div class="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4">
			{#if loadFailed === true}
				<div
					class="bg-background grid gap-3 rounded-lg border px-6 py-4 shadow-lg"
					role="alert"
				>
					<p>{m.error_generic()}</p>
					<div class="flex gap-2">
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
					aria-label={m.import_wizard_loading()}
				>
					{m.import_wizard_loading()}
				</div>
			{/if}
		</div>
	{/if}
{/if}
