<script lang="ts">
	import { dev } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';

	interface TurnstileApi {
		render(
			container: HTMLElement,
			options: {
				sitekey: string;
				theme: 'auto';
				callback: (response: string) => void;
				'expired-callback': () => void;
				'error-callback': () => void;
			},
		): string;
		reset(widgetId: string): void;
		remove(widgetId: string): void;
	}

	interface TurnstileWindow extends Window {
		turnstile?: TurnstileApi;
	}

	interface TurnstileWidgetProps {
		token?: string | null;
		/**
		 * Bound to `true` when the challenge cannot run — either it is unconfigured for this
		 * environment (no site key) or the widget script/render failed (blocked by an
		 * ad-blocker / antivirus, or a Cloudflare outage). The reservation flow reads this to
		 * fail open instead of trapping the visitor behind a check that will never complete.
		 */
		unavailable?: boolean;
	}

	const DEVELOPMENT_SITE_KEY = '1x00000000000000000000AA';
	const SCRIPT_SOURCE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
	const configuredSiteKey = env.PUBLIC_TURNSTILE_SITE_KEY;
	const siteKey =
		configuredSiteKey !== undefined && configuredSiteKey !== ''
			? configuredSiteKey
			: dev
				? DEVELOPMENT_SITE_KEY
				: '';
	let { token = $bindable(null), unavailable = $bindable(false) }: TurnstileWidgetProps =
		$props();
	let container = $state<HTMLDivElement>();
	let widgetId: string | null = null;

	// No site key means Turnstile is not configured for this environment — surface it
	// synchronously so the parent never gates the submit button on a token that can't arrive.
	// A later script/render failure flips it in onMount's catch below.
	unavailable = siteKey === '';

	function getTurnstileWindow() {
		return window as TurnstileWindow;
	}

	function loadTurnstileScript(): Promise<void> {
		if (getTurnstileWindow().turnstile !== undefined) {
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			const existingScript = document.querySelector<HTMLScriptElement>(
				`script[src="${SCRIPT_SOURCE}"]`,
			);
			const script = existingScript ?? document.createElement('script');
			script.addEventListener('load', () => resolve(), { once: true });
			script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), {
				once: true,
			});
			if (existingScript === null) {
				script.src = SCRIPT_SOURCE;
				script.async = true;
				script.defer = true;
				document.head.append(script);
			}
		});
	}

	onMount(() => {
		if (siteKey === '') {
			return;
		}
		let disposed = false;
		void loadTurnstileScript()
			.then(() => {
				if (disposed || container === undefined) {
					return;
				}
				widgetId =
					getTurnstileWindow().turnstile?.render(container, {
						sitekey: siteKey,
						theme: 'auto',
						callback: (response) => (token = response),
						'expired-callback': () => (token = null),
						'error-callback': () => (token = null),
					}) ?? null;
			})
			.catch(() => {
				if (!disposed) {
					unavailable = true;
					token = null;
				}
			});
		return () => {
			disposed = true;
			if (widgetId !== null) {
				getTurnstileWindow().turnstile?.remove(widgetId);
			}
		};
	});
</script>

{#if !unavailable}
	<div class="flex min-h-[65px] justify-center" bind:this={container}></div>
{/if}
