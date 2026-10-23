/* Variant C – Lupa a mapa: the true-size window stays the hero, a navigator minimap of the whole
   photo handles orientation in large images, a 3×3 anchor pad jumps to edges/corners, and the
   in-context preview tiles are the only target switcher (as today). */

const C_TILES = {
	gift: {
		square: {
			title: 'Karta',
			aspect: '4:3',
			body: (mobile) => (mobile ? giftCardMock(178) : scaled(giftCardMock(), 0.5)),
		},
		thumb: {
			title: 'Seznam a rezervace',
			aspect: '1:1',
			body: (mobile) =>
				mobile
					? `<div style="display:grid;gap:8px">${scaled(mobileListRowMock(), 0.72)}${scaled(reservationMock(), 0.6)}</div>`
					: `<div style="display:grid;gap:8px">${scaled(desktopListRowMock(560), 0.44)}<div style="display:flex;gap:10px;align-items:flex-start">${scaled(mobileListRowMock(), 0.5)}${scaled(reservationMock(), 0.38)}</div></div>`,
		},
	},
	wishlist: {
		card: { title: 'Karta v Přehledu', aspect: '2,84:1', body: (mobile) => scaled(overviewCardMock(), mobile ? 0.7 : 0.8) },
		thumbnail: {
			title: 'Polaroid a miniatury',
			aspect: '1:1',
			body: (mobile) => `<div style="display:flex;gap:12px;align-items:center"><div style="padding:10px 6px">${polaroidMock(mobile ? 110 : 130)}</div>${scaled(navMock(), mobile ? 0.75 : 0.85)}</div>`,
		},
		social: { title: 'Sdílení odkazu', aspect: '1,91:1', body: (mobile) => scaled(socialMock(), mobile ? 0.52 : 0.62) },
	},
};

function tileStatus(key) {
	if (S.editor === 'gift') {
		if (S.gift.mode !== 'manual') return MODE_LABELS[S.gift.mode];
		if (S.gift.targets[key]) return 'Ruční ořez';
		if (key === 'thumb' && S.gift.targets.square) return 'Přebírá z Karty';
		return 'Automaticky na střed';
	}
	const slot = S.wishlist.slots[key];
	return slot.mode === 'manual' ? 'Ruční ořez' : MODE_LABELS[slot.mode];
}

function tiles(mobile) {
	return Object.entries(C_TILES[S.editor])
		.map(
			([key, tile]) => `<div class="c-tile ${key === activeKey() ? 'on' : ''}" data-target="${key}" role="button" tabindex="0" aria-pressed="${key === activeKey()}">
				<div class="c-tile-head"><b>${tile.title}</b><span class="tiny muted">${tile.aspect}</span><span class="grow"></span><span class="chip" data-status="${key}">${tileStatus(key)}</span></div>
				<div class="c-tile-body">${tile.body(mobile)}</div>
				${key === 'thumb' ? `<div class="tiny muted" style="display:flex;gap:6px;align-items:center;justify-content:space-between">Výška mobilního řádku ${rowVariantPicker()}<button class="btn btn-sm" data-action="follow-square">Převzít ořez z Karty</button></div>` : ''}
			</div>`,
		)
		.join('');
}

const anchorPad = () =>
	`<div class="c-anchors" aria-label="Zarovnat ořez">${[0, 50, 100]
		.flatMap((y) => [0, 50, 100].map((x) => `<button type="button" data-action="anchor" data-x="${x}" data-y="${y}" title="Zarovnat ${x} % / ${y} %"></button>`))
		.join('')}</div>`;

function anchorActive(x, y) {
	const real = activeSpec().real[S.device];
	const meta = toCoverMeta(currentImage(), real.w, real.h, resolveMeta(activeKey()));
	editActive({ mode: 'cover', zoom: meta.zoom, focal: { x, y } });
}

const stageBlock = (height) =>
	`<div class="c-stage-wrap" style="height:${height}px"><div class="c-stage" data-stage></div><div data-minimap></div></div>`;

const VARIANT_C = {
	title: 'Varianta C – Lupa a mapa',
	notes: `<h3>Pevné okno + navigátor</h3>
		<p>Okno ve skutečné velikosti je hlavní plocha. Navigátor v rohu ukazuje celou fotku a výřez – kliknutím nebo tažením v něm skočíte jinam, což u velké fotky a malého výřezu šetří desítky tahů.</p>
		<ul><li>Pod oknem: zoom, „Celý“, „Vycentrovat“ a mřížka 3×3 pro zarovnání k okraji/rohu</li>
		<li>Dlaždice náhledů v kontextu jsou jediný přepínač cíle (beze změny oproti dnešku) a ukazují stav: automaticky / ručně / přebírá z Karty</li>
		<li>Šrafovaný pruh u čtverce = co zbyde v mobilním řádku zvolené výšky</li></ul>`,
	css: `
		.c-dialog { width: 1120px; }
		.c-grid { display: grid; grid-template-columns: 720px 1fr; gap: 20px; padding: 4px 20px 16px; }
		.c-workshop { display: grid; gap: 10px; align-content: start; }
		.c-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
		.c-stage-wrap { position: relative; }
		.c-stage { position: absolute; inset: 0; }
		.c-stage-wrap .minimap { right: 12px; top: 12px; }
		.c-under { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; }
		.c-anchors { display: grid; grid-template-columns: repeat(3, 14px); gap: 3px; padding: 4px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; }
		.c-anchors button { width: 14px; height: 14px; padding: 0; border: 1.5px solid var(--border-strong); border-radius: 3px; background: var(--muted); cursor: pointer; }
		.c-anchors button:hover { background: var(--primary); border-color: var(--primary); }
		.c-tiles { display: grid; grid-template-columns: 220px 1fr; gap: 12px; align-items: start; }
		.c-tile { border: 2px solid var(--border); border-radius: 14px; padding: 10px; display: grid; gap: 8px; cursor: pointer; background: #fff; }
		.c-tile:hover { border-color: var(--border-strong); }
		.c-tile.on { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary), var(--elev-compact); }
		.c-tile-head { display: flex; align-items: center; gap: 6px; font-size: 13px; }
		.c-tile-head .grow { flex: 1; }
		.c-tile-body { display: flex; justify-content: center; }
		.c-wl-grid { display: grid; grid-template-columns: 640px 1fr; gap: 20px; padding: 14px 20px 16px; }
		.c-wl-tiles { display: grid; gap: 12px; align-content: start; }
		.c-mobile .c-pad { padding: 0 14px; display: grid; gap: 10px; }
		.c-mobile .c-stage-wrap .minimap { top: auto; bottom: 34px; right: 10px; }
		.c-mobile .cs { border-radius: 0; }
		.c-mobile .c-tiles-m { display: flex; gap: 10px; overflow-x: auto; padding: 4px 14px 10px; scroll-snap-type: x mandatory; }
		.c-mobile .c-tile { flex: none; width: 300px; scroll-snap-align: start; }
	`,
	render() {
		const mobile = S.device === 'mobile';
		const gift = S.editor === 'gift';
		const title = gift ? 'Upravit dárek' : 'Nastavení seznamu';
		const head = `<div class="dialog-head"><h2 ${mobile ? 'style="font-size:19px"' : ''}>${title}</h2><span class="close-x">✕</span></div>${gift ? '' : wishlistTabs()}`;
		const status = `<span class="small muted">Upravujete: <b style="color:var(--ink)">${C_TILES[S.editor][activeKey()].title}</b></span>`;
		if (mobile) {
			return `<div class="c-mobile">${head}
				<div class="c-pad" style="margin-top:8px">${gift ? '' : sourceRow()}${modePill()}${status}</div>
				<div style="margin-top:8px">${stageBlock(400)}</div>
				<div class="c-pad" style="margin-top:8px">${zoomBar({ compact: true })}
					<div class="c-toolbar"><span><span class="btn btn-sm" data-action="whole">Celý</span> <span class="btn btn-sm" data-action="reset">Vycentrovat</span></span>${anchorPad()}</div>
					<div class="eyebrow">Vyberte místo k úpravě</div></div>
				<div class="c-tiles-m">${tiles(true)}</div>
				${gift ? `<div class="c-pad" style="margin-bottom:14px">${giftFieldsMock()}</div>` : ''}
				<div class="sheet-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div></div>`;
		}
		const under = `<div class="c-under">${zoomBar()}${anchorPad()}</div>`;
		if (gift) {
			return `<div class="dialog c-dialog">${head}<div class="c-grid"><section class="c-workshop">
				<div class="c-toolbar">${modePill()}${matPicker()}</div>
				<div class="c-toolbar">${status}${ghostToggle()}</div>
				${stageBlock(400)}${under}
				<div class="eyebrow">Místa – kliknutím vyberete, co upravujete</div>
				<div class="c-tiles">${tiles(false)}</div>
			</section>${giftFieldsMock()}</div>
			<div class="dialog-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit změny</span></div></div>`;
		}
		return `<div class="dialog c-dialog">${head}<div class="c-wl-grid"><section class="c-workshop">
				${sourceRow()}
				<div class="c-toolbar">${modePill('seg-sm')}${matPicker()}</div>
				<div class="c-toolbar">${status}${ghostToggle()}</div>
				${stageBlock(380)}${under}
			</section><section class="c-wl-tiles"><div class="eyebrow">Místa – kliknutím vyberete, co upravujete</div>${tiles(false)}</section></div>
			<div class="dialog-foot"><span class="btn">Zrušit</span><span class="btn btn-primary">Uložit</span></div></div>`;
	},
	mount(root) {
		const thumbActive = () => S.editor === 'gift' && S.gift.active === 'thumb';
		new CropStage(root.querySelector('[data-stage]'), {
			guides: () => (thumbActive() ? mobileBand() : null),
			pad: S.device === 'mobile' ? 16 : 28,
		});
		new Minimap(root.querySelector('[data-minimap]'), { width: S.device === 'mobile' ? 96 : 150 });
		for (const tile of root.querySelectorAll('.c-tile')) {
			tile.addEventListener('keydown', (event) => event.key === 'Enter' && setActive(tile.dataset.target));
		}
	},
	onRefresh() {
		for (const chip of document.querySelectorAll('[data-status]')) chip.textContent = tileStatus(chip.dataset.status);
	},
	onAction(action, event) {
		if (action === 'anchor') {
			const { x, y } = event.target.dataset;
			anchorActive(Number(x), Number(y));
		}
	},
};

start(VARIANT_C);
