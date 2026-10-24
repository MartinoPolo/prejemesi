/* Variant A – Dílna: large dark stage with the true-size window fixed in its centre, the photo
   panning/zooming behind it (ghosted outside), explicit target tabs, and a live context gallery. */

const giftTargetTabs = () =>
	segmented('active', { square: 'Karta · 4:3', thumb: 'Seznam a rezervace · 1:1' }, S.gift.active);
const wishlistSlotTabs = () =>
	segmented('active', { card: 'Přehled', thumbnail: 'Polaroid · 1:1', social: 'Sdílení' }, S.wishlist.active);

const thumbGuides = () => (S.editor === 'gift' && S.gift.active === 'thumb' ? mobileBand() : null);

function ctxTile(target, label, html, extra = '') {
	return `<div class="ctx-tile is-target" data-target="${target}">
		<div class="ctx-label">${label}${extra}</div>${html}</div>`;
}

const fallbackBadge = '<span class="badge-fallback" data-fallback-badge hidden>přebírá ořez Karty</span>';

function giftContext(device) {
	if (device === 'desktop') {
		return `<div class="a-ctx">
			${ctxTile('square', 'Karta v mřížce', scaled(giftCardMock(), 0.56))}
			<div style="display:grid;gap:12px;align-content:start">
				${ctxTile('thumb', 'Seznam – desktop', scaled(desktopListRowMock(560), 0.6), fallbackBadge)}
				<div style="display:flex;gap:14px;align-items:flex-start">
					${ctxTile('thumb', 'Seznam – mobil', scaled(mobileListRowMock(), 0.66))}
					${ctxTile('thumb', 'Rezervace', scaled(reservationMock(), 0.46))}
				</div>
				<div class="small muted" style="display:flex;gap:6px;align-items:center">Výška mobilního řádku ${rowVariantPicker()}</div>
			</div></div>`;
	}
	return `<div class="hscroll">
		${ctxTile('square', 'Karta', giftCardMock(178))}
		${ctxTile('thumb', 'Seznam', mobileListRowMock(undefined, 300), fallbackBadge)}
		${ctxTile('thumb', 'Rezervace', scaled(reservationMock(), 0.7))}
	</div><div class="small muted" style="display:flex;gap:6px;align-items:center;padding:0 14px">Výška řádku ${rowVariantPicker()}</div>`;
}

function wishlistContext(device) {
	if (device === 'desktop') {
		return `<div class="a-wl-ctx">
			${ctxTile('card', 'Karta v Přehledu', overviewCardMock())}
			<div style="display:flex;gap:12px;align-items:flex-start">
				${ctxTile('thumbnail', 'Polaroid v hlavičce', `<div style="padding:12px 8px">${polaroidMock()}</div>`)}
				${ctxTile('thumbnail', 'Navigace a řádky', navMock())}
			</div>
			${ctxTile('social', 'Odkaz ve zprávě (Open Graph)', scaled(socialMock(), 0.76))}
		</div>`;
	}
	return `<div class="hscroll">
		${ctxTile('card', 'Přehled', scaled(overviewCardMock(342), 0.8))}
		${ctxTile('thumbnail', 'Polaroid', `<div style="padding:10px 8px">${polaroidMock(120)}</div>`)}
		${ctxTile('thumbnail', 'Navigace', scaled(navMock(), 0.9))}
		${ctxTile('social', 'Sdílení', scaled(socialMock(), 0.6))}
	</div>`;
}

const thumbNote = () =>
	S.editor === 'gift' && S.gift.active === 'thumb'
		? `<div class="tiny muted a-note">Šrafované okraje čtverce se na mobilu v řádku „${MOBILE_ROW.variants[S.rowVariant]}“ oříznou. <button class="btn btn-sm" data-action="follow-square">Převzít ořez z Karty</button></div>`
		: '';

const VARIANT_A = {
	title: 'Varianta A – Dílna',
	notes: `<h3>Dílna s pevným oknem</h3>
		<p>Okno ořezu má vždy skutečnou velikost cílového místa. Fotka se pod ním posouvá a přibližuje, mimo okno zůstává ztlumená pro orientaci.</p>
		<ul><li>Táhnutí = posun, kolečko / dva prsty = zoom kolem kurzoru, dvojklik = vycentrovat</li>
		<li>Klávesnice: šipky (Shift = větší krok), + / −, 0</li>
		<li>Náhledy v kontextu jsou živé a kliknutím přepnou cíl</li>
		<li>Jakýkoli posun z Vyplnit/Přizpůsobit přepne na Ručně</li></ul>`,
	css: `
		.a-dialog { width: 1120px; }
		.a-grid { display: grid; grid-template-columns: 700px 1fr; gap: 20px; padding: 4px 20px 16px; }
		.a-workshop { display: grid; gap: 10px; align-content: start; padding: 12px; border-radius: 14px; background: var(--muted); border: 2px solid var(--border); }
		.a-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
		.a-stage { height: 390px; }
		.a-ctx { display: grid; grid-template-columns: 210px 1fr; gap: 16px; padding-top: 6px; border-top: 2px dashed var(--border); }
		.a-wl-ctx { display: grid; gap: 18px; align-content: start; }
		.a-note { display: flex; align-items: center; gap: 8px; min-height: 26px; }
		.a-mobile .a-stage { height: 300px; border-radius: 0; }
		.a-mobile .a-pad { padding: 0 14px; display: grid; gap: 10px; }
		.a-mobile .a-pad > .seg { width: 100%; }
		.a-mobile .a-pad > .seg button { flex: 1; }
		.a-wl-grid { display: grid; grid-template-columns: 640px 1fr; gap: 22px; padding: 14px 20px 16px; }
	`,
	render() {
		if (S.device === 'desktop') return S.editor === 'gift' ? this.giftDesktop() : this.wishlistDesktop();
		return S.editor === 'gift' ? this.giftMobile() : this.wishlistMobile();
	},
	giftDesktop() {
		return `<div class="dialog a-dialog">
			<div class="dialog-head"><h2>Upravit dárek</h2><span class="close-x">✕</span></div>
			<div class="a-grid"><section class="a-workshop">
				<div class="a-toolbar">${modePill()}${matPicker()}</div>
				<div class="a-toolbar">${giftTargetTabs()}${ghostToggle()}</div>
				<div class="a-stage" data-stage></div>
				${zoomBar()}${thumbNote()}
				<div class="eyebrow">Takhle to uvidí ostatní</div>
				${giftContext('desktop')}
			</section>${giftFieldsMock()}</div>
			<div class="dialog-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit změny</span></div>
		</div>`;
	},
	giftMobile() {
		return `<div class="a-mobile">
			<div class="dialog-head"><h2 style="font-size:19px">Upravit dárek</h2><span class="close-x">✕</span></div>
			<div class="a-pad">${modePill()}${giftTargetTabs()}</div>
			<div class="a-stage" data-stage style="margin-top:10px"></div>
			<div class="a-pad" style="margin-top:8px">${zoomBar({ compact: true })}
				<div style="display:flex;gap:8px;justify-content:space-between"><span><span class="btn btn-sm" data-action="whole">Celý</span> <span class="btn btn-sm" data-action="reset">Vycentrovat</span></span>${segmented('mat', MAT_LABELS, currentMat(), 'seg-sm')}</div>
				${thumbNote()}
				<div class="eyebrow">Takhle to uvidí ostatní</div></div>
			<div style="padding:0 14px">${giftContext('mobile')}</div>
			<div class="a-pad" style="margin:14px 0">${giftFieldsMock()}</div>
			<div class="sheet-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div>
		</div>`;
	},
	wishlistDesktop() {
		return `<div class="dialog" style="width:1120px">
			<div class="dialog-head"><h2>Nastavení seznamu</h2><span class="close-x">✕</span></div>
			${wishlistTabs()}
			<div class="a-wl-grid"><section class="a-workshop">
				${sourceRow()}
				<div class="a-toolbar">${wishlistSlotTabs()}${ghostToggle()}</div>
				<div class="a-toolbar"><span class="small muted">Režim pro „${activeSpec().label}“</span>${modePill('seg-sm')}${matPicker()}</div>
				<div class="a-stage" data-stage style="height:360px"></div>
				${zoomBar()}
			</section><section>
				<div class="eyebrow" style="margin-bottom:10px">Kde se obrázek zobrazí</div>
				${wishlistContext('desktop')}
			</section></div>
			<div class="dialog-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div>
		</div>`;
	},
	wishlistMobile() {
		return `<div class="a-mobile">
			<div class="dialog-head"><h2 style="font-size:19px">Nastavení seznamu</h2><span class="close-x">✕</span></div>
			${wishlistTabs()}
			<div class="a-pad" style="margin-top:10px">${sourceRow()}${wishlistSlotTabs()}${modePill()}</div>
			<div class="a-stage" data-stage style="margin-top:10px"></div>
			<div class="a-pad" style="margin-top:8px">${zoomBar({ compact: true })}
				<div style="display:flex;gap:8px;justify-content:space-between"><span><span class="btn btn-sm" data-action="whole">Celý</span> <span class="btn btn-sm" data-action="reset">Vycentrovat</span></span>${segmented('mat', MAT_LABELS, currentMat(), 'seg-sm')}</div>
				<div class="eyebrow">Kde se obrázek zobrazí</div></div>
			<div style="padding:0 14px 14px">${wishlistContext('mobile')}</div>
			<div class="sheet-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div>
		</div>`;
	},
	mount(root) {
		const host = root.querySelector('[data-stage]');
		new CropStage(host, { guides: thumbGuides, pad: S.device === 'mobile' ? 16 : 28 });
	},
};

start(VARIANT_A);
