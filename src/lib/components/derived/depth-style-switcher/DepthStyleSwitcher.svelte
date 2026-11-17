<script lang="ts">
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { setUserDepthStyle } from '$lib/modules/settings/settings.remote.js';
	import {
		DEFAULT_DEPTH_STYLE,
		DEPTH_STYLES,
		isDepthStyle,
		type DepthStyle,
	} from '$lib/theme/depth_styles.js';
	import { RootAppearancePreference } from '$lib/theme/root_appearance_preference.svelte.js';
	import { depthStyleSwitcherVariants } from './depth_style_switcher_variants.js';

	const depth = new RootAppearancePreference<DepthStyle>({
		datasetKey: 'depth',
		isValue: isDepthStyle,
		fallback: DEFAULT_DEPTH_STYLE,
		persist: setUserDepthStyle,
		description: 'depth style',
	});

	const labels: Record<DepthStyle, () => string> = {
		soft: m.depth_style_soft,
		ink: m.depth_style_ink,
		black: m.depth_style_black,
	};

	const styles = depthStyleSwitcherVariants();

	function selectDepth(value: string) {
		// The toggle group clears its value when the selected option is pressed again.
		if (value === '') {
			depth.selected = depth.current ?? DEFAULT_DEPTH_STYLE;
			return;
		}
		depth.select(value);
	}
</script>

<div class={styles.root()}>
	<span class={styles.label()}>
		{m.depth_style_label()}
	</span>
	<ToggleGroup.Root
		type="single"
		aria-label={m.depth_style_label()}
		intent="outline"
		bind:value={depth.selected}
		onValueChange={selectDepth}
		class={styles.choices({ synchronized: depth.synchronized })}
		aria-hidden={!depth.synchronized}
	>
		{#each DEPTH_STYLES as style (style)}
			<ToggleGroup.Item
				value={style}
				aria-label={labels[style]()}
				data-depth={style}
				class={styles.choice()}
				surfaceClass={styles.choiceSurface()}
			>
				{labels[style]()}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</div>
