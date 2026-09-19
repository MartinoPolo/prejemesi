import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { sharedChromeLaunchOptions } from '../../scripts/browser-automation.mjs';

const browser = await chromium.launch({ ...sharedChromeLaunchOptions, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const mockupUrl = pathToFileURL(resolve('designs/gift-desktop-alignment/variants/variant-a.html')).href;

function nearlyEqual(values, tolerance = 1) {
  return Math.max(...values) - Math.min(...values) <= tolerance;
}

function intersects(first, second, tolerance = 0.5) {
  return first.left < second.right - tolerance && first.right > second.left + tolerance && first.top < second.bottom - tolerance && first.bottom > second.top + tolerance;
}

async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(160);
}

async function select(id, value) {
  await page.locator(id).selectOption(value);
  await settle();
}

async function geometry() {
  return page.locator('[data-testid="gift-card"]').evaluateAll(cards => cards.map(card => {
    const cardRect = card.getBoundingClientRect();
    const rectangle = selector => card.querySelector(selector).getBoundingClientRect();
    const title = rectangle('.gift-title');
    const description = rectangle('.description-row');
    const linksElement = card.querySelector('.link-track');
    const links = linksElement.getBoundingClientRect();
    const footer = rectangle('.card-footer');
    const price = rectangle('.price');
    const actions = rectangle('.action-group');
    const relativeTop = rect => rect.top - cardRect.top;
    const rectanglesIntersect = (first, second) => first.left < second.right - 0.5 && first.right > second.left + 0.5 && first.top < second.bottom - 0.5 && first.bottom > second.top + 0.5;
    return {
      height: cardRect.height,
      titleTop: relativeTop(title), descriptionTop: relativeTop(description), linksTop: relativeTop(links), footerTop: relativeTop(footer),
      titleDescriptionClear: title.bottom <= description.top + 0.5,
      descriptionLinksClear: description.bottom <= links.top + 0.5,
      linksUnclipped: linksElement.scrollHeight <= linksElement.clientHeight + 1,
      linkDimensions: [linksElement.clientHeight, linksElement.scrollHeight],
      priceActionsClear: !rectanglesIntersect(price, actions),
      contained: card.scrollWidth <= card.clientWidth + 1 && card.scrollHeight <= card.clientHeight + 1
    };
  }));
}

async function assertInternalTracks(label) {
  const cards = await geometry();
  assert.ok(cards.every(card => card.titleDescriptionClear), `${label}: painted title does not intersect description`);
  assert.ok(cards.every(card => card.descriptionLinksClear), `${label}: description does not intersect links`);
  assert.ok(cards.every(card => card.linksUnclipped), `${label}: globally measured links are not vertically clipped (${JSON.stringify(cards.map(card => card.linkDimensions))})`);
  assert.ok(cards.every(card => card.priceActionsClear), `${label}: price and actions do not intersect`);
  assert.ok(cards.every(card => card.contained), `${label}: cards contain all tracks`);
  return cards;
}

async function assertOverlaySeparation(label) {
  const card = page.locator('[data-gift-id="backpack"]');
  const boxes = await card.locator('.category-badge, .state-overlay, .reservation-identity, .priority-badge').evaluateAll(nodes => nodes.map(node => ({ className: node.className, ...node.getBoundingClientRect().toJSON() })));
  for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < boxes.length; secondIndex += 1) {
      assert.ok(!intersects(boxes[firstIndex], boxes[secondIndex]), `${label}: ${boxes[firstIndex].className} and ${boxes[secondIndex].className} are disjoint`);
    }
  }
}

try {
  await page.goto(mockupUrl);
  await settle();

  const tokenState = await page.evaluate(() => ({
    fontHead: getComputedStyle(document.documentElement).getPropertyValue('--font-head').trim(),
    paletteBrand: getComputedStyle(document.documentElement).getPropertyValue('--p-brand').trim(),
    titleFont: getComputedStyle(document.querySelector('.gift-title')).fontFamily,
    titleSize: Number.parseFloat(getComputedStyle(document.querySelector('.gift-title')).fontSize),
    appSheetLoaded: [...document.styleSheets].some(sheet => sheet.href?.endsWith('/src/app.css'))
  }));
  assert.ok(tokenState.appSheetLoaded, 'canonical src/app.css stylesheet loaded');
  assert.match(tokenState.fontHead, /DynaPuff Variable/, 'canonical heading token wins over stale reference tokens');
  assert.equal(tokenState.paletteBrand, '#1e9be9', 'canonical sky palette token loaded');
  assert.match(tokenState.titleFont, /DynaPuff Variable/);
  assert.equal(tokenState.titleSize, 24, 'production desktop title size is 24px');

  assert.equal(await page.locator('.card-body > .price').count(), await page.locator('.gift-card').count(), 'price belongs to content directly below links');
  const initialHeights = (await geometry()).map(card => card.height);
  for (const preset of ['stress', 'short', 'nodesc', 'mixed', 'stress', 'mixed']) {
    await select('#content-control', preset);
  }
  await select('#width-control', '880');
  await page.locator('#zoom-control').check();
  await settle();
  await select('#content-control', 'stress');
  await select('#width-control', '1440');
  await page.locator('#zoom-control').uncheck();
  await select('#width-control', '1180');
  await select('#content-control', 'mixed');
  const restoredHeights = (await geometry()).map(card => card.height);
  assert.ok(restoredHeights.every((height, index) => Math.abs(height - initialHeights[index]) <= 1), 'repeated option changes restore the initial minimal height');
  assert.ok(await page.locator('.card-body').evaluateAll(bodies => bodies.every(body => {
    const contentBottom = body.querySelector('.price').getBoundingClientRect().bottom;
    const padding = Number.parseFloat(getComputedStyle(body).paddingBottom);
    return body.getBoundingClientRect().bottom - contentBottom - padding <= 1;
  })), 'restored cards have no unexplained slack below content');
  assert.ok(await page.locator('.gift-card').evaluateAll(cards => cards.every(card => {
    const rectangle = selector => card.querySelector(selector).getBoundingClientRect();
    const price = rectangle('.price');
    const links = rectangle('.link-track');
    const actions = rectangle('.action-group');
    const title = rectangle('.name-row');
    return price.bottom <= actions.top && price.top >= links.bottom
      && Math.abs(price.left - title.left) < 1 && Math.abs(links.left - title.left) < 1
      && Math.abs(actions.left - title.left) < 1 && Math.abs(actions.right - title.right) < 1
      && getComputedStyle(card.querySelector('.card-footer')).borderTopWidth === '0px';
  })), 'content and actions share side insets, price follows links, and separator is absent');

  let cards = await assertInternalTracks('mixed wide');
  assert.equal(cards.length, 8, 'mixed preset renders all realistic gifts');
  for (const key of ['height', 'titleTop', 'descriptionTop', 'linksTop', 'footerTop']) assert.ok(nearlyEqual(cards.map(card => card[key])), `${key} is shared across rows and groups`);
  assert.equal(await page.locator('[data-gift-id="voucher"] .category-badge').count(), 0, 'no-category state is modeled');
  await assertOverlaySeparation('wide');

  const mixedTitleTrack = Number.parseFloat(await page.locator('#collection').evaluate(node => getComputedStyle(node).getPropertyValue('--title-track')));
  await select('#content-control', 'short');
  const shortTitleTrack = Number.parseFloat(await page.locator('#collection').evaluate(node => getComputedStyle(node).getPropertyValue('--title-track')));
  assert.ok(shortTitleTrack < mixedTitleTrack, 'all-short content shrinks the measured shared title track');

  await select('#content-control', 'nodesc');
  assert.equal(await page.locator('#collection').getAttribute('data-has-description'), 'false');
  assert.equal(await page.locator('.description-row').first().evaluate(node => getComputedStyle(node).display), 'none', 'all-empty descriptions collapse globally');
  assert.equal(Number.parseFloat(await page.locator('#collection').evaluate(node => getComputedStyle(node).getPropertyValue('--description-track'))), 0, 'description track is exactly zero');
  assert.equal(await page.locator('.link-track').first().evaluate(node => getComputedStyle(node).gridRowStart), '3', 'links retain explicit row placement when description is absent');

  await select('#content-control', 'stress');
  await select('#width-control', '880');
  assert.equal(await page.locator('#collection').getAttribute('data-footer-mode'), 'stacked', 'exact three-column minimum activates collection-wide footer fallback');
  assert.equal(await page.locator('.gift-grid').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 3);
  cards = await assertInternalTracks('narrow stress');
  assert.ok(nearlyEqual(cards.map(card => card.height)), 'narrow stress cards retain equal collection height');
  const pricesContained = await page.locator('.price').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.closest('.card-body').clientWidth));
  assert.ok(pricesContained, 'prices remain fully readable');
  await assertOverlaySeparation('narrow');

  await select('#width-control', '1440');
  assert.equal(await page.locator('.gift-grid').first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 4, 'wide mode uses four columns');

  const normalSizes = await page.locator('[data-gift-id="headphones"]').evaluate(card => ({
    title: Number.parseFloat(getComputedStyle(card.querySelector('.gift-title')).fontSize),
    description: Number.parseFloat(getComputedStyle(card.querySelector('.description-row')).fontSize),
    price: Number.parseFloat(getComputedStyle(card.querySelector('.price')).fontSize)
  }));
  await page.locator('#zoom-control').check();
  await settle();
  const zoomSizes = await page.locator('[data-gift-id="headphones"]').evaluate(card => ({
    title: Number.parseFloat(getComputedStyle(card.querySelector('.gift-title')).fontSize),
    description: Number.parseFloat(getComputedStyle(card.querySelector('.description-row')).fontSize),
    price: Number.parseFloat(getComputedStyle(card.querySelector('.price')).fontSize)
  }));
  for (const key of Object.keys(normalSizes)) assert.equal(zoomSizes[key], normalSizes[key] * 2, `200% control doubles ${key} text`);
  assert.equal(await page.locator('#collection').getAttribute('data-footer-mode'), 'stacked', '200% text uses measured shared footer fallback');
  cards = await assertInternalTracks('200% text');
  assert.ok(nearlyEqual(cards.map(card => card.height)), '200% text cards remain equal');
  await assertOverlaySeparation('200% text');
  await page.locator('#zoom-control').uncheck();
  await settle();

  await select('#theme-control', 'dark');
  assert.ok(await page.locator('html').evaluate(node => node.classList.contains('dark')), 'dark theme applies');
  await select('#palette-control', 'grape');
  assert.equal(await page.locator('html').getAttribute('data-palette'), 'grape', 'palette applies');

  await select('#role-control', 'recipient');
  assert.equal(await page.locator('.state-overlay').count(), 0, 'ordinary recipient sees no reservation state or identity');
  await select('#lifecycle-control', 'draft');
  assert.ok(await page.locator('#collection').isVisible(), 'recipient manager can inspect draft');
  await select('#role-control', 'promoted');
  assert.ok(await page.locator('#collection').isVisible(), 'promoted recipient manager can inspect draft');
  assert.equal(await page.getByText('Jana Dvořáková', { exact: false }).count(), 0, 'promoted recipient cannot see giver identity');
  assert.ok(await page.locator('.like-readonly').count(), 'promoted recipient receives read-only Like counts');
  assert.equal(await page.getByRole('button', { name: 'Rezervovat', exact: true }).count(), 0, 'promoted recipient cannot reserve');
  assert.equal(await page.locator('.reservation-identity').count(), 0, 'promoted recipient receives no generic identity summary');
  await page.locator('[data-gift-id="teapot"] [data-more]').click();
  assert.equal(await page.getByRole('menuitem', { name: /Koupeno|Zrušit moji rezervaci/ }).count(), 0, 'promoted recipient has no own reservation controls');
  await page.keyboard.press('Escape');
  await select('#role-control', 'visitor');
  assert.ok(await page.locator('#empty-state').isVisible(), 'visitor draft is privacy-gated');
  await select('#role-control', 'anonymous');
  assert.ok(await page.locator('#empty-state').isVisible(), 'anonymous draft is privacy-gated');

  await select('#lifecycle-control', 'shared');
  assert.equal(await page.locator('[data-gift-id="teapot"] .sticker-button.primary').count(), 0, 'anonymous viewer cannot reserve an already-owned reservation anew');
  assert.equal(await page.getByRole('button', { name: 'Koupeno' }).count(), 0, 'anonymous visitor has no Bought control');
  assert.equal(await page.locator('.reservation-identity').count(), 0, 'anonymous visitor receives no generic identity summary');
  await page.locator('[data-gift-id="teapot"] [data-more]').click();
  assert.ok(await page.getByRole('menuitem', { name: 'Zrušit moji rezervaci' }).count(), 'anonymous owner can cancel their reservation');
  await page.keyboard.press('Escape');
  await select('#role-control', 'manager');
  assert.ok(await page.getByText('Jana Dvořáková', { exact: true }).count(), 'manager sees separately gated giver identity');
  assert.equal(await page.getByText(/Petr Svoboda|1 další/).count(), 0, 'multiple reservations never reveal a name list or count');
  assert.ok(await page.locator('[data-gift-id="headphones"] .action-group').getByRole('button', { name: 'Rezervovat' }).count(), 'manager keeps Reserve when available');
  assert.ok(await page.locator('[data-gift-id="headphones"] .action-group').getByRole('button', { name: 'Přijato' }).count(), 'manager keeps Received alongside Reserve');
  const ownManagerMore = page.locator('[data-gift-id="teapot"] [data-more]');
  await ownManagerMore.click();
  assert.ok(await page.getByRole('menuitem', { name: 'Zrušit moji rezervaci' }).count(), 'manager cancellation is limited to own reservation');
  assert.ok(await page.getByRole('menuitem', { name: 'Koupeno' }).count(), 'authenticated own manager reservation exposes Bought in More');
  assert.equal(await page.getByRole('menuitem', { name: /Odstranit/ }).count(), 0, 'shared More does not invent broad deletion');
  await page.keyboard.press('Escape');

  await select('#lifecycle-control', 'archive');
  assert.equal(await page.locator('.like-button, .like-readonly').count(), 0, 'archive exposes no Like mutation or count control');
  assert.ok(await page.locator('.page-intro [data-demo-action]').isDisabled(), 'archive disables Add');
  await page.locator('[data-more]').first().click();
  assert.ok(await page.getByRole('menuitem', { name: 'Upravit přání' }).isDisabled(), 'archive disables Edit');
  await page.keyboard.press('Escape');

  await select('#lifecycle-control', 'shared');
  await page.locator('.gift-card').first().focus();
  await page.keyboard.press('Enter');
  assert.ok(await page.locator('#detail-dialog').evaluate(dialog => dialog.open), 'detail opens by keyboard');
  assert.ok((await page.locator('#detail-title').textContent()).length > 10, 'full title is available in detail');
  await page.keyboard.press('Escape');

  const more = page.locator('[data-more]').first();
  await more.focus();
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.locator('#more-popover').isVisible(), 'More opens by keyboard');
  assert.ok(await page.locator('#more-popover a').count(), 'overflow links are reachable');
  await page.keyboard.press('Escape');
  assert.equal(await more.getAttribute('aria-expanded'), 'false', 'More closes and updates state');

  console.log('PASS variant-a strengthened geometry, tokens, privacy, lifecycle, detail and More checks');
} finally {
  await browser.close();
}
