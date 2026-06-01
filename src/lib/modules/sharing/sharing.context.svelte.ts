import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { SHARE_WIZARD_STEPS, type ShareWizardStep } from './types.js';

type SharingContext = ReturnType<typeof createSharingContext>;

const [useSharing, setSharingInternal] = createContext<SharingContext>();
export { useSharing };

export function setSharingContext(getShortId: () => string, getIsShared: () => boolean) {
	const context = createSharingContext(getShortId, getIsShared);
	setSharingInternal(context);
	return context;
}

function createSharingContext(getShortId: () => string, getIsShared: () => boolean) {
	const wizardOpen = new StateRaw(false);
	const wizardStep = new StateRaw<ShareWizardStep>(SHARE_WIZARD_STEPS.confirm);
	const wishlistShortId = new Derived(getShortId);
	const shared = new Derived(getIsShared);
	const linkCopied = new StateRaw(false);

	const shareUrl = new Derived(() => {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return `${origin}/w/${wishlistShortId.current}`;
	});

	const shareUrlDisplay = new Derived(() => {
		const host = typeof window !== 'undefined' ? window.location.host : 'darecky.cz';
		return `${host}/w/${wishlistShortId.current}`;
	});

	function openWizard() {
		if (shared.current) {
			wizardStep.current = SHARE_WIZARD_STEPS.share;
		} else {
			wizardStep.current = SHARE_WIZARD_STEPS.confirm;
		}
		wizardOpen.current = true;
	}

	function closeWizard() {
		wizardOpen.current = false;
		linkCopied.current = false;
	}

	function goToStep(step: ShareWizardStep) {
		wizardStep.current = step;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl.current);
			linkCopied.current = true;
			setTimeout(() => {
				linkCopied.current = false;
			}, 2000);
		} catch {
			const textArea = document.createElement('textarea');
			textArea.value = shareUrl.current;
			textArea.style.position = 'fixed';
			textArea.style.opacity = '0';
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			linkCopied.current = true;
			setTimeout(() => {
				linkCopied.current = false;
			}, 2000);
		}
	}

	return {
		wizardOpen,
		wizardStep,
		wishlistShortId,
		shared,
		linkCopied,
		shareUrl,
		shareUrlDisplay,
		openWizard,
		closeWizard,
		goToStep,
		copyLink,
	};
}
