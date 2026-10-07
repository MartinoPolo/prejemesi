import type {
	GiftContextAction,
	GiftContextActionGroup,
} from '$lib/modules/gifts/gift_context_actions.js';

/** Actions whose menu row opens a choice list instead of running a command. */
export type GiftContextChoiceAction = Extract<GiftContextAction, 'priority' | 'category'>;

export interface GiftContextChoiceMenu {
	title: string;
	ready: boolean;
	/** The leading `null` option clears the current choice. */
	options: readonly { id: string | null; label: string }[];
	selectedId: string | null;
	choose: (id: string | null) => void;
}

export interface GiftContextCommandEntry {
	kind: 'command';
	action: Exclude<GiftContextAction, GiftContextChoiceAction>;
	label: string;
	disabled: boolean;
	reversal: boolean;
	undo: boolean;
	pressed?: boolean;
	href?: string;
	select: () => void;
}

export interface GiftContextSubmenuEntry {
	kind: 'submenu';
	action: GiftContextChoiceAction;
	label: string;
	disabled: boolean;
	menu: GiftContextChoiceMenu;
}

export type GiftContextMenuEntry = GiftContextCommandEntry | GiftContextSubmenuEntry;

export interface GiftContextMenuGroup {
	name: GiftContextActionGroup['name'];
	entries: readonly GiftContextMenuEntry[];
}
