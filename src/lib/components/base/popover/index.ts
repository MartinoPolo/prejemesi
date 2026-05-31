import Root from './popover.svelte';
import Trigger from './popover-trigger.svelte';
import Content from './popover-content.svelte';
import Item from './popover-item.svelte';
import Label from './popover-label.svelte';
import Divider from './popover-divider.svelte';

export { Root, Trigger, Content, Item, Label, Divider };
export {
	Root as Popover,
	Trigger as PopoverTrigger,
	Content as PopoverContent,
	Item as PopoverItem,
	Label as PopoverLabel,
	Divider as PopoverDivider,
};
export type { PopoverItemProps } from './popover_variants.js';
