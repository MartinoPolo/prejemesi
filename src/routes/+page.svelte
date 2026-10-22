<script lang="ts">
	import LandingNav from '$lib/components/blocks/landing/LandingNav.svelte';
	import LandingHero from '$lib/components/blocks/landing/LandingHero.svelte';
	import LandingDemo from '$lib/components/blocks/landing/LandingDemo.svelte';
	import LandingHowItWorks from '$lib/components/blocks/landing/LandingHowItWorks.svelte';
	import LandingFeatureHighlights from '$lib/components/blocks/landing/LandingFeatureHighlights.svelte';
	import LandingCallToAction from '$lib/components/blocks/landing/LandingCallToAction.svelte';
	import LandingFooter from '$lib/components/blocks/landing/LandingFooter.svelte';
	import { SITE_URL } from '$lib/config/site.js';
	import {
		buildLandingSocialMetaTags,
		landingPageUrl,
	} from '$lib/modules/sharing/social_meta.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import DemoStartForm from '$lib/components/blocks/demo/DemoStartForm.svelte';
</script>

<svelte:head>
	<title>{m.landing_meta_title()}</title>
	<meta name="description" content={m.landing_meta_description()} />
	{#each buildLandingSocialMetaTags(getLocale()) as tag (tag.property ?? tag.name)}
		<meta property={tag.property} name={tag.name} content={tag.content} />
	{/each}
	<link rel="canonical" href={landingPageUrl(getLocale())} />
	<link rel="alternate" hreflang="cs" href={SITE_URL} />
	<link rel="alternate" hreflang="en" href={`${SITE_URL}/en`} />
	<link rel="alternate" hreflang="x-default" href={SITE_URL} />
</svelte:head>

<LandingNav />
<LandingHero />
<LandingDemo />
<div class="flex justify-center bg-background px-4 py-8">
	<DemoStartForm label={m.demo_start_full} />
</div>
<LandingHowItWorks />
<LandingFeatureHighlights />
<LandingCallToAction />
<LandingFooter />
