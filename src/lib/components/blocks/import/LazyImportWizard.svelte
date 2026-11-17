<script lang="ts" module>
	import {
		lazyComponent,
		type LazyComponent,
	} from '$lib/components/derived/lazy-dialog/index.js';

	const importWizardLoader = lazyComponent(() => import('./ImportWizard.svelte'));
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { LazyDialog } from '$lib/components/derived/lazy-dialog/index.js';
	import type { ComponentProps } from 'svelte';
	import type ImportWizardComponent from './ImportWizard.svelte';

	type ImportWizardProps = ComponentProps<typeof ImportWizardComponent>;
	type LazyImportWizardProps = ImportWizardProps & {
		/** Replaced in tests; every app mount shares the module loader. */
		loader?: LazyComponent<typeof ImportWizardComponent>;
		reloadPage?: () => void;
	};

	let {
		open = $bindable(false),
		loader = importWizardLoader,
		reloadPage,
		...wizardProps
	}: LazyImportWizardProps = $props();
</script>

<LazyDialog bind:open {loader} loadingLabel={m.import_wizard_loading()} {reloadPage}>
	{#snippet children(Wizard, dialog)}
		<!-- Unmounted while closed, so every opening starts a fresh wizard. -->
		{#if open}
			<Wizard bind:open={dialog.open} {...wizardProps} />
		{/if}
	{/snippet}
</LazyDialog>
