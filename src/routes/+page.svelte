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
	import { SITE_URL, SOCIAL_PREVIEW_IMAGE_URL } from '$lib/config/site.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.landing_meta_title()}</title>
	<meta name="description" content={m.landing_meta_description()} />
	<meta property="og:title" content={m.landing_og_title()} />
	<meta property="og:description" content={m.landing_og_description()} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={SITE_URL} />
	<meta property="og:image" content={SOCIAL_PREVIEW_IMAGE_URL} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={m.landing_og_title()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={m.landing_og_title()} />
	<meta name="twitter:description" content={m.landing_og_description()} />
	<meta name="twitter:image" content={SOCIAL_PREVIEW_IMAGE_URL} />
	<link rel="canonical" href={SITE_URL} />
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
