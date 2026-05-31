import Root from './tooltip.svelte';
import Trigger from './tooltip-trigger.svelte';
import Content from './tooltip-content.svelte';
import Provider from './tooltip-provider.svelte';
import Portal from './tooltip-portal.svelte';
import SimpleTooltip from './SimpleTooltip.svelte';

export { tooltipContentVariants } from './tooltip_variants.js';

export {
	Root,
	Trigger,
	Content,
	Provider,
	Portal,
	SimpleTooltip,
	//
	Root as Tooltip,
	Content as TooltipContent,
	Trigger as TooltipTrigger,
	Provider as TooltipProvider,
	Portal as TooltipPortal,
};
