<script lang="ts">
	import type { Component } from 'svelte';
	import * as Card from '$lib/components/base/card/index.js';
	import {
		settingsSectionHeaderVariants,
		type SettingsSectionTone,
	} from './settings_section_variants.js';

	interface Props {
		icon: Component;
		title: string;
		description: string;
		tone?: SettingsSectionTone;
	}

	let { icon: Icon, title, description, tone = 'default' }: Props = $props();

	const styles = $derived(settingsSectionHeaderVariants({ tone }));
</script>

<Card.Header>
	<div class={styles.row()}>
		<Icon class={styles.icon()} />
		<div>
			<Card.Title class={styles.title()}>{title}</Card.Title>
			<Card.Description>{description}</Card.Description>
		</div>
	</div>
</Card.Header>
