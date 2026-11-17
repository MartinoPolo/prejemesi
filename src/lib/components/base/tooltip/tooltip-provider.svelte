<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { markSharedTooltipProvider } from './tooltip_provider_context.js';

	let { ...restProps }: TooltipPrimitive.ProviderProps = $props();

	markSharedTooltipProvider();
</script>

<TooltipPrimitive.Provider {...restProps} />
