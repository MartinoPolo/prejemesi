<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Card from '$lib/components/base/card/index.js';
	import SettingsSectionHeader from './SettingsSectionHeader.svelte';
	import { dangerActionCardVariants } from './settings_section_variants.js';

	interface Props {
		icon: Component;
		title: string;
		description: string;
		/** Names the action beside its button; without it the button sits alone at the end. */
		actionTitle?: string;
		actionDescription?: string;
		/** Flat inside an already elevated surface, such as a dialog panel. */
		elevation?: 'ordinary' | 'flat';
		/** A warning or consequence shown above the action. */
		notice?: Snippet;
		action: Snippet;
	}

	let {
		icon,
		title,
		description,
		actionTitle,
		actionDescription,
		elevation = 'ordinary',
		notice,
		action,
	}: Props = $props();

	const styles = dangerActionCardVariants();
</script>

<Card.Root {elevation} class={styles.root()}>
	<SettingsSectionHeader {icon} {title} {description} tone="danger" />
	<Card.Content>
		<div class={styles.content()}>
			{@render notice?.()}
			<div class={styles.actionRow()}>
				{#if actionTitle !== undefined}
					<div class={styles.actionText()}>
						<p class={styles.actionTitle()}>{actionTitle}</p>
						{#if actionDescription !== undefined}
							<p class={styles.actionDescription()}>{actionDescription}</p>
						{/if}
					</div>
				{/if}
				{@render action()}
			</div>
		</div>
	</Card.Content>
</Card.Root>
