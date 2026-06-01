<script lang="ts">
	import LandingNav from '$lib/components/blocks/landing/LandingNav.svelte';
	import LandingHero from '$lib/components/blocks/landing/LandingHero.svelte';
	import LandingHowItWorks from '$lib/components/blocks/landing/LandingHowItWorks.svelte';
	import LandingFeaturesHeader from '$lib/components/blocks/landing/LandingFeaturesHeader.svelte';
	import LandingFeatureSecretReservations from '$lib/components/blocks/landing/LandingFeatureSecretReservations.svelte';
	import LandingFeatureShareByLink from '$lib/components/blocks/landing/LandingFeatureShareByLink.svelte';
	import LandingFeatureThemes from '$lib/components/blocks/landing/LandingFeatureThemes.svelte';
	import LandingFeatureFreeForever from '$lib/components/blocks/landing/LandingFeatureFreeForever.svelte';
	import LandingCallToAction from '$lib/components/blocks/landing/LandingCallToAction.svelte';
	import LandingFooter from '$lib/components/blocks/landing/LandingFooter.svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.landing_meta_title()}</title>
	<meta name="description" content={m.landing_meta_description()} />
	<meta property="og:title" content={m.landing_og_title()} />
	<meta property="og:description" content={m.landing_og_description()} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://darecky.cz" />
</svelte:head>

<LandingNav />
<LandingHero />
<LandingHowItWorks />
<LandingFeaturesHeader />
<LandingFeatureSecretReservations />
<LandingFeatureShareByLink />
<LandingFeatureThemes />
<LandingFeatureFreeForever />
<LandingCallToAction />
<LandingFooter />
