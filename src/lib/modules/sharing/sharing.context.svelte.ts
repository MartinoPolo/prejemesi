import { createContext } from 'svelte';
import { StateRaw } from '$lib/reactivity/state.svelte.js';
import { Derived } from '$lib/reactivity/derived.svelte.js';
import { SHARE_WIZARD_STEPS, type ShareWizardStep } from './types.js';

type SharingContext = ReturnType<typeof createSharingContext>;

const [useSharing, setSharingInternal] = createContext<SharingContext>();
export { useSharing };

export function setSharingContext(shortId: string, isAlreadyShared: boolean) {
	const context = createSharingContext(shortId, isAlreadyShared);
	setSharingInternal(context);
	return context;
}

function createSharingContext(shortId: string, isAlreadyShared: boolean) {
	const wizardOpen = new StateRaw(false);
	const wizardStep = new StateRaw<ShareWizardStep>(SHARE_WIZARD_STEPS.confirm);
	const wishlistShortId = new StateRaw(shortId);
	const shared = new StateRaw(isAlreadyShared);
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
			// Already shared — skip confirmation, go directly to share step
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

	function markShared() {
		shared.current = true;
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl.current);
			linkCopied.current = true;
			setTimeout(() => {
				linkCopied.current = false;
			}, 2000);
		} catch {
			// Fallback: try execCommand
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
		markShared,
		copyLink,
	};
}
