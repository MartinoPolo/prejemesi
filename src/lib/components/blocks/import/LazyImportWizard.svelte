<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { LazyDialog, lazyComponent } from '$lib/components/derived/lazy-dialog/index.js';
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
		reloadPage,
		...wizardProps
	}: LazyImportWizardProps = $props();

	// svelte-ignore state_referenced_locally (the loader is injected once, for tests)
	const importWizard = lazyComponent(loadWizard);
</script>

<LazyDialog {open} loader={importWizard} loadingLabel={m.import_wizard_loading()} {reloadPage}>
	{#snippet children(Wizard)}
		<!-- Unmounted while closed, so every opening starts a fresh wizard. -->
		{#if open}
			<Wizard bind:open {...wizardProps} />
		{/if}
	{/snippet}
</LazyDialog>
