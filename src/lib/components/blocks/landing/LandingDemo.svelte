<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import { Skeleton } from '$lib/components/base/skeleton/index.js';
	import * as m from '$lib/paraglide/messages.js';
	type DemoLoader = () => Promise<{ default: Component }>;
	let {
		loadDemo = () => import('./LandingDemoInteractive.svelte'),
		reloadPage = () => window.location.reload(),
	}: { loadDemo?: DemoLoader; reloadPage?: () => void } = $props();

	let Demo = $state<Component>();
	let loadFailed = $state(false);
	let mounted = false;

	async function load(): Promise<void> {
		try {
			const component = (await loadDemo()).default;
			if (mounted) {
				Demo = component;
			}
		} catch (error) {
			console.error('[LandingDemo] interactive chunk failed to load', error);
			if (mounted) {
				loadFailed = true;
			}
		}
	}

	onMount(() => {
		mounted = true;
		void load();
		return () => {
			mounted = false;
		};
	});
</script>

<section
	class="bg-stripes scroll-mt-16"
	id="ukazka"
	aria-label={m.landing_demo_section_label()}
	data-testid="landing-demo"
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div class="mx-auto flex max-w-[640px] flex-col items-center text-center">
			<span class="section-eyebrow">
				<span aria-hidden="true">🎮</span>
				{m.landing_demo_eyebrow()}
			</span>
			<h2 class="section-headline demo-headline">{m.landing_demo_headline()}</h2>
			<p class="mb-4 text-(length:--text-lg) leading-relaxed text-muted-foreground">
				{m.landing_demo_intro()}
			</p>
			<span class="demo-ribbon mb-12" data-testid="landing-demo-badge">
				<span aria-hidden="true">✂️</span>
				{m.landing_demo_badge()}
			</span>
		</div>

		{#if Demo !== undefined}
			<Demo />
		{:else if loadFailed}
			<div
				class="mx-auto flex min-h-80 max-w-md flex-col items-center justify-center gap-4 text-center"
				role="alert"
			>
				<p>{m.landing_demo_unavailable()}</p>
				<Button onclick={reloadPage}>{m.import_wizard_reload()}</Button>
			</div>
		{:else}
			<div
				class="landing-demo-pending flex min-h-80 flex-col gap-6"
				role="status"
				aria-label={m.landing_demo_loading()}
			>
				<Skeleton class="h-24 w-full rounded-lg" />
				<div class="grid gap-6 lg:grid-cols-2">
					<Skeleton class="h-52 w-full rounded-lg" />
					<Skeleton class="h-52 w-full rounded-lg" />
				</div>
			</div>
		{/if}
		<noscript>
			<style>
				.landing-demo-pending {
					display: none;
				}
			</style>
			<p class="text-center text-muted-foreground">{m.landing_demo_no_javascript()}</p>
		</noscript>
	</div>
</section>

<style>
	.demo-headline {
		margin-bottom: var(--space-4);
	}

	.demo-ribbon {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		border: 2px dashed var(--ink);
		border-radius: 999px;
		background: var(--note-tint);
		color: var(--note-ink);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		transform: rotate(-1.5deg);
	}
</style>
