import { expect, type Locator, type Page } from '@playwright/test';
import * as m from '../../../src/lib/paraglide/messages.js';

async function isVisibleAndOperable(locator: Locator): Promise<boolean> {
	if ((await locator.count()) === 0 || !(await locator.isVisible())) {
		return false;
	}
	return locator.evaluate(
		(element) =>
			element.closest('[inert]') === null && element.closest('[aria-hidden="true"]') === null,
	);
}

export async function visibleDirectReceivedAction(gift: Locator): Promise<Locator | null> {
	const action = gift.getByTestId('gift-received-toggle').filter({ visible: true });
	return (await isVisibleAndOperable(action)) ? action : null;
}

function pageLocale(documentLanguage: string | null) {
	return documentLanguage?.toLowerCase().startsWith('en') === true ? 'en' : 'cs';
}

async function receivedCommandName(page: Page, received: boolean): Promise<string> {
	const locale = pageLocale(await page.locator('html').getAttribute('lang'));
	const messageOptions = { locale } as const;
	return received
		? m.gift_mark_unreceived({}, messageOptions)
		: m.gift_mark_received({}, messageOptions);
}

async function giftIsReceived(page: Page, gift: Locator): Promise<boolean> {
	if (await gift.locator('[data-state-primary][data-state-kind="received"]').isVisible()) {
		return true;
	}

	const directAction = await visibleDirectReceivedAction(gift);
	return (
		directAction !== null &&
		(await directAction.getAttribute('aria-label')) === (await receivedCommandName(page, true))
	);
}

async function openOverflowReceivedAction(
	page: Page,
	gift: Locator,
	currentlyReceived: boolean,
): Promise<Locator> {
	const actionRow = gift.getByTestId('gift-action-row');
	await expect(actionRow).toHaveAttribute('data-overflow-actions', /(?:^|\s)received(?:\s|$)/);

	const more = gift.getByTestId('gift-more-actions').filter({ visible: true });
	await expect(more).toBeVisible();
	expect(await isVisibleAndOperable(more)).toBe(true);
	await expect(more).toBeEnabled();
	await more.click();

	const commandName = await receivedCommandName(page, currentlyReceived);
	const menuCommand = page
		.getByRole('menuitem', { name: commandName, exact: true })
		.filter({ visible: true });
	const sheetCommand = page
		.getByRole('dialog')
		.getByRole('button', { name: commandName, exact: true })
		.filter({ visible: true });
	const command = (await menuCommand.count()) > 0 ? menuCommand : sheetCommand;
	await expect(command).toBeVisible();
	await expect(command).toBeEnabled();
	return command;
}

export async function setGiftReceived(page: Page, gift: Locator, received: boolean): Promise<void> {
	const currentlyReceived = await giftIsReceived(page, gift);
	if (currentlyReceived === received) {
		return;
	}

	const commandName = await receivedCommandName(page, currentlyReceived);
	const directAction = await visibleDirectReceivedAction(gift);
	if (directAction !== null) {
		await expect(directAction).toHaveAccessibleName(commandName);
		await expect(directAction).toBeEnabled();
		await directAction.click();
		return;
	}

	await (await openOverflowReceivedAction(page, gift, currentlyReceived)).click();
}

export async function expectReceivedActionReachable(page: Page, gift: Locator): Promise<void> {
	if ((await visibleDirectReceivedAction(gift)) !== null) {
		return;
	}

	const received = await gift
		.locator('[data-state-primary][data-state-kind="received"]')
		.isVisible();
	await openOverflowReceivedAction(page, gift, received);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu').filter({ visible: true })).toHaveCount(0);
	await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
}
