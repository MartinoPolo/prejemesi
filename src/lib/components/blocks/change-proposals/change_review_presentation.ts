import type { Component } from 'svelte';
import * as m from '$lib/paraglide/messages.js';
import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
import BanIcon from '@lucide/svelte/icons/ban';
import BookmarkIcon from '@lucide/svelte/icons/bookmark';
import CheckIcon from '@lucide/svelte/icons/check';
import FlagIcon from '@lucide/svelte/icons/flag';
import LetterTextIcon from '@lucide/svelte/icons/letter-text';
import ListPlusIcon from '@lucide/svelte/icons/list-plus';
import NotebookPenIcon from '@lucide/svelte/icons/notebook-pen';
import PackageCheckIcon from '@lucide/svelte/icons/package-check';
import PencilIcon from '@lucide/svelte/icons/pencil';
import PlusIcon from '@lucide/svelte/icons/plus';
import TagIcon from '@lucide/svelte/icons/tag';
import Trash2Icon from '@lucide/svelte/icons/trash-2';
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
import Undo2Icon from '@lucide/svelte/icons/undo-2';
import UserPlusIcon from '@lucide/svelte/icons/user-plus';
import type { BadgeTone } from '$lib/components/base/badge/index.js';
import { CHANGE_KIND, type ChangeKind } from '$lib/modules/change_proposals/types.js';
import {
	CHANGE_ROW_DISPLAY_STATUS,
	type ChangeRowDisplayStatus,
} from '$lib/modules/change_proposals/change_review_decisions.js';
import type { PluralMessages } from '$lib/modules/change_proposals/change_review_copy.js';

/** Change-type colours: only AA text tokens, each with the hue its header band tints with. */
const KIND_TONE = {
	danger: {
		text: 'var(--status-danger-text)',
		icon: 'var(--status-danger-text)',
		bandMix: 'var(--status-danger)',
		bandStrength: '12%',
	},
	success: {
		text: 'var(--status-success-text)',
		icon: 'var(--status-success-text)',
		bandMix: 'var(--status-success)',
		bandStrength: '12%',
	},
	link: {
		text: 'var(--brand-link)',
		icon: 'var(--brand-link)',
		bandMix: 'var(--status-info)',
		bandStrength: '12%',
	},
	ink: {
		text: 'var(--foreground)',
		icon: 'var(--muted-foreground)',
		bandMix: 'var(--ink)',
		bandStrength: '7%',
	},
} as const;

type ChangeKindTone = (typeof KIND_TONE)[keyof typeof KIND_TONE];

interface ChangeKindPresentation {
	tone: ChangeKindTone;
	icon: Component;
	title: () => string;
	count: PluralMessages;
}

/** The one type-to-colour-and-icon table that row titles and summary counts share. */
export const CHANGE_KIND_PRESENTATION = {
	[CHANGE_KIND.giftCreation]: {
		tone: KIND_TONE.success,
		icon: PlusIcon,
		title: m.change_review_kind_gift_creation,
		count: {
			one: m.change_review_count_gift_creation_one,
			few: m.change_review_count_gift_creation_few,
			other: m.change_review_count_gift_creation_other,
		},
	},
	[CHANGE_KIND.giftEdit]: {
		tone: KIND_TONE.ink,
		icon: PencilIcon,
		title: m.change_review_kind_gift_edit,
		count: {
			one: m.change_review_count_gift_edit_one,
			few: m.change_review_count_gift_edit_few,
			other: m.change_review_count_gift_edit_other,
		},
	},
	[CHANGE_KIND.descriptionAppend]: {
		tone: KIND_TONE.ink,
		icon: LetterTextIcon,
		title: m.change_review_kind_description_append,
		count: {
			one: m.change_review_count_description_append_one,
			few: m.change_review_count_description_append_few,
			other: m.change_review_count_description_append_other,
		},
	},
	[CHANGE_KIND.giftDeletion]: {
		tone: KIND_TONE.danger,
		icon: Trash2Icon,
		title: m.change_review_kind_gift_deletion,
		count: {
			one: m.change_review_count_gift_deletion_one,
			few: m.change_review_count_gift_deletion_few,
			other: m.change_review_count_gift_deletion_other,
		},
	},
	[CHANGE_KIND.received]: {
		tone: KIND_TONE.ink,
		icon: PackageCheckIcon,
		title: m.change_review_kind_received,
		count: {
			one: m.change_review_count_received_one,
			few: m.change_review_count_received_few,
			other: m.change_review_count_received_other,
		},
	},
	[CHANGE_KIND.reorder]: {
		tone: KIND_TONE.ink,
		icon: ArrowUpDownIcon,
		title: m.change_review_kind_reorder,
		count: {
			one: m.change_review_count_reorder_one,
			few: m.change_review_count_reorder_few,
			other: m.change_review_count_reorder_other,
		},
	},
	[CHANGE_KIND.category]: {
		tone: KIND_TONE.ink,
		icon: TagIcon,
		title: m.change_review_kind_category,
		count: {
			one: m.change_review_count_category_one,
			few: m.change_review_count_category_few,
			other: m.change_review_count_category_other,
		},
	},
	[CHANGE_KIND.priorityLevel]: {
		tone: KIND_TONE.ink,
		icon: FlagIcon,
		title: m.change_review_kind_priority_level,
		count: {
			one: m.change_review_count_priority_level_one,
			few: m.change_review_count_priority_level_few,
			other: m.change_review_count_priority_level_other,
		},
	},
	[CHANGE_KIND.reservation]: {
		tone: KIND_TONE.link,
		icon: BookmarkIcon,
		title: m.change_review_kind_reservation,
		count: {
			one: m.change_review_count_reservation_one,
			few: m.change_review_count_reservation_few,
			other: m.change_review_count_reservation_other,
		},
	},
	[CHANGE_KIND.managerInvitation]: {
		tone: KIND_TONE.link,
		icon: UserPlusIcon,
		title: m.change_review_kind_manager_invitation,
		count: {
			one: m.change_review_count_manager_invitation_one,
			few: m.change_review_count_manager_invitation_few,
			other: m.change_review_count_manager_invitation_other,
		},
	},
	[CHANGE_KIND.wishlistDetails]: {
		tone: KIND_TONE.ink,
		icon: NotebookPenIcon,
		title: m.change_review_kind_wishlist_details,
		count: {
			one: m.change_review_count_wishlist_details_one,
			few: m.change_review_count_wishlist_details_few,
			other: m.change_review_count_wishlist_details_other,
		},
	},
	[CHANGE_KIND.wishlistCreation]: {
		tone: KIND_TONE.success,
		icon: ListPlusIcon,
		title: m.change_review_kind_wishlist_creation,
		count: {
			one: m.change_review_count_wishlist_creation_one,
			few: m.change_review_count_wishlist_creation_few,
			other: m.change_review_count_wishlist_creation_other,
		},
	},
	[CHANGE_KIND.undo]: {
		tone: KIND_TONE.ink,
		icon: Undo2Icon,
		title: m.change_review_kind_undo,
		count: {
			one: m.change_review_count_undo_one,
			few: m.change_review_count_undo_few,
			other: m.change_review_count_undo_other,
		},
	},
} satisfies Record<ChangeKind, ChangeKindPresentation>;

interface ChangeRowStatusPresentation {
	label: () => string;
	tone: BadgeTone;
	icon: Component | null;
}

export const CHANGE_ROW_STATUS_PRESENTATION = {
	[CHANGE_ROW_DISPLAY_STATUS.ready]: {
		label: m.change_review_status_ready,
		tone: 'success',
		icon: CheckIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.partial]: {
		label: m.change_review_status_partial,
		tone: 'primary',
		icon: null,
	},
	[CHANGE_ROW_DISPLAY_STATUS.declined]: {
		label: m.change_review_status_declined,
		tone: 'neutral',
		icon: null,
	},
	[CHANGE_ROW_DISPLAY_STATUS.kept]: {
		label: m.change_review_status_kept,
		tone: 'neutral',
		icon: null,
	},
	[CHANGE_ROW_DISPLAY_STATUS.dropped]: {
		label: m.change_review_status_dropped,
		tone: 'neutral',
		icon: BanIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.needsDecision]: {
		label: m.change_review_status_needs_decision,
		tone: 'warning',
		icon: TriangleAlertIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.undecided]: {
		label: m.change_review_status_undecided,
		tone: 'warning',
		icon: TriangleAlertIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.confirmed]: {
		label: m.change_review_status_confirmed,
		tone: 'primary',
		icon: CheckIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.conflict]: {
		label: m.change_review_status_conflict,
		tone: 'warning',
		icon: TriangleAlertIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.rejected]: {
		label: m.change_review_status_rejected,
		tone: 'danger',
		icon: BanIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.applied]: {
		label: m.change_review_status_applied,
		tone: 'success',
		icon: CheckIcon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.notApplied]: {
		label: m.change_review_status_not_applied,
		tone: 'neutral',
		icon: null,
	},
	[CHANGE_ROW_DISPLAY_STATUS.undone]: {
		label: m.change_review_status_undone,
		tone: 'info',
		icon: Undo2Icon,
	},
	[CHANGE_ROW_DISPLAY_STATUS.discarded]: {
		label: m.change_review_status_discarded,
		tone: 'neutral',
		icon: null,
	},
	[CHANGE_ROW_DISPLAY_STATUS.changedSinceApply]: {
		label: m.change_review_status_changed_since_apply,
		tone: 'danger',
		icon: TriangleAlertIcon,
	},
} satisfies Record<ChangeRowDisplayStatus, ChangeRowStatusPresentation>;

/** "Rozhodněte 3 změny", shown and read out when Apply is pressed with decisions still open. */
export const UNRESOLVED_DECISION_MESSAGES: PluralMessages = {
	one: m.change_review_unresolved_message_one,
	few: m.change_review_unresolved_message_few,
	other: m.change_review_unresolved_message_other,
};
