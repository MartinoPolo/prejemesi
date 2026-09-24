(() => {
  const imageRoot = '../../../static/demo/v1/';
  const gifts = [
    { id: 'headphones', group: 'Největší radost', title: 'Sluchátka Sony WH-1000XM5', shortTitle: 'Sluchátka Sony', description: 'Bezdrátová, ideálně černá. Hodí se i na dlouhé cesty vlakem.', image: 'headphones.jpg', category: 'Elektronika', priority: 'Moc si přeji', price: '7 990 Kč', quantity: 1, links: [['Alza', 'https://www.alza.cz/'], ['Sony', 'https://www.sony.cz/']], state: 'available' },
    { id: 'backpack', group: 'Největší radost', title: 'Lehký turistický batoh Osprey Talon 22 v tmavě modré barvě', shortTitle: 'Turistický batoh', description: '', image: 'backpack.jpg', category: 'Sport, výlety a opravdu dlouhý název kategorie', priority: 'Vysoká priorita', price: '2 890–4 299 Kč', quantity: 1, links: [['4camping.cz – modrý model ve správné velikosti', 'https://www.4camping.cz/'], ['Hanibal', 'https://www.hanibal.cz/'], ['Osprey EU', 'https://www.osprey.com/eu/'], ['Srovnat ceny', 'https://www.heureka.cz/']], state: 'reserved', reserver: 'Jana Dvořáková' },
    { id: 'teapot', group: 'Největší radost', title: 'Ručně glazovaná konvice na čaj', shortTitle: 'Čajová konvice', description: 'Objem kolem jednoho litru, barva není důležitá.', image: 'teapot.jpg', category: 'Domov', priority: null, price: 'Cena neuvedena', quantity: 1, links: [], state: 'own' },
    { id: 'watercolours', group: 'Největší radost', title: 'Profesionální akvarelové barvy Schmincke Horadam v dřevěné kazetě se štětci', shortTitle: 'Akvarelové barvy', description: 'Sada s půlpánvičkami; nemusí být přesně tahle značka, ale prosím bez studentské řady.', image: 'watercolours.jpg', category: 'Tvoření', priority: 'Moc si přeji', price: '3 499–12 999 Kč', quantity: 2, links: [['Výtvarné potřeby', 'https://www.vytvarne-potreby.cz/'], ['Výrobce', 'https://www.schmincke.de/'], ['Barevná sada', 'https://example.com/barvy'], ['Štětce', 'https://example.com/stetce'], ['Alternativa', 'https://example.com/alternativa']], state: 'available' },
    { id: 'book', group: 'Další nápady', title: 'Kniha Sapiens: Stručné dějiny lidstva', shortTitle: 'Kniha Sapiens', description: 'České vydání v pevné vazbě.', image: 'plant-book.jpg', category: 'Knihy', priority: null, price: '399 Kč', quantity: 1, links: [['Knihy Dobrovský', 'https://www.knihydobrovsky.cz/']], state: 'received' },
    { id: 'candle', group: 'Další nápady', title: 'Svíčka Yankee Candle s jemnou dřevitou vůní', shortTitle: 'Vonná svíčka', description: '', image: 'candle.jpg', category: 'Pro radost', priority: 'Když zbude místo', price: '550 Kč', quantity: 3, links: [], state: 'available' },
    { id: 'keyboard', group: 'Další nápady', title: 'Mechanická klávesnice s českým rozložením, tichými spínači a bezdrátovým připojením pro tři zařízení', shortTitle: 'Klávesnice', description: 'Tichá, nízkoprofilová a bez RGB. Přesný model ještě vybírám.', image: null, category: 'Elektronika', priority: null, price: '1 800–6 499 Kč', quantity: 1, links: [['Keychron – evropský obchod s dlouhým názvem odkazu', 'https://www.keychron.com/'], ['Alza', 'https://www.alza.cz/'], ['CZC archiv', 'https://example.com/czc'], ['Porovnání spínačů', 'https://example.com/switche']], state: 'multi', reserver: 'Petr Svoboda + 1 další' },
    { id: 'voucher', group: 'Další nápady', title: 'Dárkový poukaz na víkendový kurz vaření asijské kuchyně pro dva', shortTitle: 'Kurz vaření', description: 'Termín vybereme později. Platnost poukazu alespoň jeden rok.', image: null, category: null, priority: null, price: '4 900 Kč', quantity: 1, links: [['Chefparade', 'https://www.chefparade.cz/'], ['Alternativní kurz', 'https://example.com/kurz']], state: 'available' }
  ];

  const controls = {
    width: document.querySelector('#width-control'), theme: document.querySelector('#theme-control'), palette: document.querySelector('#palette-control'),
    role: document.querySelector('#role-control'), lifecycle: document.querySelector('#lifecycle-control'), content: document.querySelector('#content-control'),
    guides: document.querySelector('#guides-control'), zoom: document.querySelector('#zoom-control')
  };
  const collection = document.querySelector('#collection');
  const workspace = document.querySelector('#workspace');
  const emptyState = document.querySelector('#empty-state');
  const detailDialog = document.querySelector('#detail-dialog');
  const morePopover = document.querySelector('#more-popover');
  const toast = document.querySelector('#toast');
  let toastTimer;
  let menuTrigger = null;

  const roleText = {
    recipient: ['Obdarovaný: překvapení zůstává skryté.', 'Vpravo: Přijato + Více (upravit). Bez jmen a stavu rezervací.'],
    promoted: ['Povýšený obdarovaný: spravuje obsah, nevidí identity dárců a počet To se mi líbí je jen ke čtení.', 'Vpravo: Přijato + Více (upravit). Nemůže rezervovat ani sledovat nákup.'],
    manager: ['Správce: vidí identity a spravuje seznam.', 'Vpravo: Rezervovat (je-li dostupné) + Přijato + Více (upravit; vlastní rezervaci lze zrušit).'],
    visitor: ['Přihlášený návštěvník: vidí dostupnost, cizí identity jsou skryté.', 'Vpravo: Rezervovat / Koupeno + Více. Zrušit lze jen vlastní rezervaci.'],
    anonymous: ['Anonymní návštěvník: bez identity a bez soukromého sledování nákupu.', 'Vpravo: Rezervovat + Více (odkazy). Žádná akce Koupeno.']
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function visibleGift(gift) {
    const preset = controls.content.value;
    return {
      ...gift,
      title: preset === 'short' ? gift.shortTitle : gift.title,
      description: preset === 'nodesc' || preset === 'short' ? '' : gift.description,
      links: preset === 'short' ? gift.links.slice(0, 1) : gift.links,
      category: preset === 'stress' && gift.id === 'keyboard' ? 'Elektronika, pracovní vybavení a příslušenství na cesty' : gift.category,
      price: preset === 'stress' && gift.id === 'watercolours' ? '123 456–1 234 567 Kč' : gift.price
    };
  }

  function statusFor(gift) {
    const role = controls.role.value;
    if (role === 'recipient') return '';
    if (gift.state === 'received') return '<span class="state-overlay">Dárek předán</span>';
    if (gift.state === 'own' && ['manager', 'visitor', 'anonymous'].includes(role)) return '<span class="state-overlay own">Vaše rezervace</span>';
    if (gift.state === 'multi') return `<span class="state-overlay">Rezervováno</span>${role === 'manager' ? '<span class="reservation-identity">Rezervováno více lidmi</span>' : ''}`;
    if (gift.state === 'reserved' || gift.state === 'own') {
      const identity = role === 'manager' && gift.reserver ? `<span class="reservation-identity">${escapeHtml(gift.reserver)}</span>` : '';
      return `<span class="state-overlay">Rezervováno</span>${identity}`;
    }
    return '';
  }

  function primaryAction(gift) {
    const role = controls.role.value;
    const archived = controls.lifecycle.value === 'archive';
    if (archived) return '<button class="sticker-button secondary" type="button" disabled>Jen pro čtení</button>';
    const reservationAwareManager = role === 'manager';
    if (role === 'recipient' || role === 'promoted') {
      return `<button class="sticker-button secondary" data-demo-action type="button">${gift.state === 'received' ? 'Vrátit' : 'Přijato'}</button>`;
    }
    if (reservationAwareManager) {
      const canReserve = gift.state === 'available';
      const reserve = canReserve ? '<button class="sticker-button primary" data-demo-action type="button">Rezervovat</button>' : '';
      return `${reserve}<button class="sticker-button secondary" data-demo-action type="button">${gift.state === 'received' ? 'Vrátit' : 'Přijato'}</button>`;
    }
    if (gift.state === 'reserved' || gift.state === 'multi' || gift.state === 'received' || gift.state === 'own' && role === 'anonymous') return '';
    if (gift.state === 'own' && role === 'visitor') return '<button class="sticker-button secondary" data-demo-action type="button">Koupeno</button>';
    return '<button class="sticker-button primary" data-demo-action type="button">Rezervovat</button>';
  }

  function likeMarkup(gift) {
    if (controls.lifecycle.value === 'archive' || controls.role.value === 'recipient') return '';
    const count = gift.id.length % 4 + 1;
    if (controls.role.value === 'promoted') return `<span class="like-readonly" aria-label="To se líbí ${count} lidem">♡ ${count}</span>`;
    return `<button class="like-button" data-demo-action type="button" aria-label="To se mi líbí, počet ${count}">♡ ${count}</button>`;
  }

  function cardMarkup(sourceGift) {
    const gift = visibleGift(sourceGift);
    const shownLinks = gift.links.slice(0, 2);
    const image = gift.image ? `<img src="${imageRoot}${gift.image}" alt="">` : '<div class="image-placeholder" aria-hidden="true">🎁</div>';
    const links = shownLinks.length ? shownLinks.map(([label, url]) => `<a class="link-chip" href="${url}" target="_blank" rel="noopener noreferrer"><span>↗ ${escapeHtml(label)}</span></a>`).join('') : '<span class="link-empty">Bez odkazu</span>';
    const overflow = gift.links.length > 2 ? `<button class="link-overflow menu-link-trigger" type="button" data-gift-id="${gift.id}">+${gift.links.length - 2} další</button>` : '';
    const dimmed = gift.state === 'received' || (controls.role.value !== 'recipient' && ['reserved', 'multi'].includes(gift.state)) || (controls.role.value === 'anonymous' && gift.state === 'own');
    const category = gift.category ? `<span class="category-badge">${escapeHtml(gift.category)}</span>` : '';
    return `<article class="gift-card${dimmed ? ' dimmed' : ''}" data-gift-id="${gift.id}" data-testid="gift-card" tabindex="0" role="button" aria-label="Otevřít detail: ${escapeHtml(gift.title)}">
      <div class="image-area">${image}<div class="top-badges">${category}${likeMarkup(gift)}</div>${gift.priority ? `<span class="priority-badge">${escapeHtml(gift.priority)}</span>` : ''}${statusFor(gift)}</div>
      <div class="card-body"><div class="name-row"><h3 class="gift-title" title="${escapeHtml(gift.title)}">${escapeHtml(gift.title)}</h3>${gift.quantity > 1 ? `<span class="quantity" aria-label="Počet kusů ${gift.quantity}">×${gift.quantity}</span>` : ''}</div><div class="description-row">${escapeHtml(gift.description)}</div><div class="link-track">${links}${overflow}</div><span class="price${gift.price === 'Cena neuvedena' ? ' empty' : ''}">${escapeHtml(gift.price)}</span></div>
      <footer class="card-footer"><div class="action-group">${primaryAction(gift)}<button class="more-button" type="button" data-more="${gift.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Více akcí pro ${escapeHtml(gift.title)}">•••</button></div></footer>
    </article>`;
  }

  function render() {
    closeMore(false);
    const managerRoles = ['recipient', 'promoted', 'manager'];
    const nonManagerDraft = controls.lifecycle.value === 'draft' && !managerRoles.includes(controls.role.value);
    collection.hidden = nonManagerDraft;
    emptyState.hidden = !nonManagerDraft;
    const [summary, mapping] = roleText[controls.role.value];
    document.querySelector('#role-summary').textContent = summary;
    document.querySelector('#action-mapping').textContent = controls.lifecycle.value === 'archive' ? 'Archiv: všechny změny jsou v prototypu vypnuté; odkazy a detail zůstávají dostupné.' : mapping;
    const addButton = document.querySelector('.page-intro [data-demo-action]');
    addButton.disabled = controls.lifecycle.value === 'archive' || !managerRoles.includes(controls.role.value);
    if (nonManagerDraft) return;
    const groups = [...new Set(gifts.map(gift => gift.group))];
    collection.innerHTML = groups.map(group => `<section class="gift-section" aria-labelledby="section-${group === 'Největší radost' ? 'top' : 'more'}"><div class="section-header"><h2 id="section-${group === 'Největší radost' ? 'top' : 'more'}">${group}</h2><span class="section-rule"></span></div><div class="gift-grid">${gifts.filter(gift => gift.group === group).map(cardMarkup).join('')}</div></section>`).join('');
    collection.dataset.hasDescription = String(gifts.some(gift => visibleGift(gift).description.trim()));
    collection.classList.toggle('show-guides', controls.guides.checked);
    requestAnimationFrame(() => void document.fonts.ready.then(syncCollectionTracks));
  }

  function syncCollectionTracks() {
    const cards = [...collection.querySelectorAll('.gift-card')];
    if (!cards.length) return;
    collection.style.setProperty('--shared-card-height', 'auto');
    collection.style.setProperty('--link-track', 'auto');
    collection.style.setProperty('--action-track', 'auto');
    collection.style.setProperty('--price-track', 'auto');
    collection.dataset.wide = String(workspace.clientWidth >= 1360);
    collection.style.setProperty('--title-lines', '1');
    let needsTwoTitleLines = false;
    let titleLineHeight = 0;
    collection.querySelectorAll('.gift-title').forEach(title => {
      title.style.display = 'block'; title.style.webkitLineClamp = 'unset'; title.style.overflow = 'visible';
      const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
      titleLineHeight = Math.max(titleLineHeight, lineHeight);
      if (title.scrollHeight > lineHeight * 1.35) needsTwoTitleLines = true;
      title.style.display = ''; title.style.webkitLineClamp = ''; title.style.overflow = '';
    });
    const titleLines = needsTwoTitleLines ? 2 : 1;
    collection.style.setProperty('--title-lines', String(titleLines));
    collection.style.setProperty('--title-track', `${Math.ceil(titleLineHeight * titleLines)}px`);

    const hasDescription = collection.dataset.hasDescription === 'true';
    const description = collection.querySelector('.description-row');
    const descriptionLineHeight = hasDescription ? Number.parseFloat(getComputedStyle(description).lineHeight) : 0;
    collection.style.setProperty('--description-track', `${hasDescription ? Math.ceil(descriptionLineHeight + 7) : 0}px`);

    collection.style.setProperty('--link-track', 'auto');
    const linkTracks = [...collection.querySelectorAll('.link-track')];
    linkTracks.forEach(track => { track.style.overflow = 'visible'; });
    const linkTrackHeight = Math.max(...linkTracks.map(track => Math.ceil(track.scrollHeight))) + 2;
    linkTracks.forEach(track => { track.style.overflow = ''; });
    collection.style.setProperty('--link-track', `${linkTrackHeight}px`);

    const priceHeight = Math.max(...cards.map(card => card.querySelector('.price').getBoundingClientRect().height));
    collection.style.setProperty('--price-track', `${Math.ceil(priceHeight)}px`);
    collection.dataset.footerMode = 'stacked';
    const actionHeight = Math.max(...cards.map(card => card.querySelector('.action-group').getBoundingClientRect().height));
    collection.style.setProperty('--action-track', `${Math.ceil(actionHeight)}px`);
    const maxHeight = Math.max(...cards.map(card => Math.ceil(card.getBoundingClientRect().height)));
    collection.style.setProperty('--shared-card-height', `${maxHeight}px`);
  }

  function openDetail(id) {
    const gift = visibleGift(gifts.find(item => item.id === id));
    document.querySelector('#detail-title').textContent = gift.title;
    document.querySelector('#detail-description').textContent = gift.description || 'K tomuto přání není přidaný popis.';
    document.querySelector('#detail-links').innerHTML = gift.links.length ? gift.links.map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(label)} — ${escapeHtml(url)}</a>`).join('') : '<span class="link-empty">Bez odkazu</span>';
    detailDialog.showModal();
  }

  function openMore(id, trigger) {
    const gift = visibleGift(gifts.find(item => item.id === id));
    closeMore(false); menuTrigger = trigger; trigger.setAttribute('aria-expanded', 'true');
    document.querySelector('#more-title').textContent = gift.title;
    document.querySelector('#more-links').innerHTML = gift.links.length ? gift.links.map(([label, url]) => `<a class="menu-action" role="menuitem" href="${url}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(label)}</a>`).join('') : '<span class="link-empty">Bez odkazu</span>';
    const manager = ['recipient', 'promoted', 'manager'].includes(controls.role.value);
    const reservationAwareManager = controls.role.value === 'manager';
    const ownReservation = ['visitor', 'anonymous'].includes(controls.role.value) && gift.state === 'own';
    const ownManagerReservation = reservationAwareManager && gift.state === 'own';
    const disabled = controls.lifecycle.value === 'archive' ? ' disabled' : '';
    let actions = manager
      ? `<button class="menu-action" role="menuitem" data-demo-action${disabled}>Upravit přání</button><button class="menu-action" role="menuitem" data-demo-action${disabled}>Nastavit prioritu</button><button class="menu-action" role="menuitem" data-demo-action${disabled}>Změnit kategorii</button><button class="menu-action" role="menuitem" data-demo-action${disabled}>Vybrat více přání</button>`
      : '<button class="menu-action" role="menuitem" data-detail-action>Zobrazit celý detail</button>';
    if (gift.links.length) actions += '<button class="menu-action" role="menuitem" data-demo-action>Kopírovat první odkaz</button>';
    if (ownReservation || ownManagerReservation) actions += '<button class="menu-action" role="menuitem" data-demo-action>Zrušit moji rezervaci</button>';
    if (ownManagerReservation) actions += `<button class="menu-action" role="menuitem" data-demo-action${disabled}>Koupeno</button>`;
    document.querySelector('#more-actions').innerHTML = actions;
    morePopover.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 322, Math.max(12, rect.right - 300));
    const top = Math.min(window.innerHeight - morePopover.offsetHeight - 12, rect.bottom + 8);
    morePopover.style.left = `${left}px`; morePopover.style.top = `${Math.max(12, top)}px`;
    morePopover.querySelector('[role="menuitem"]')?.focus();
  }

  function closeMore(returnFocus = true) {
    if (menuTrigger) menuTrigger.setAttribute('aria-expanded', 'false');
    morePopover.hidden = true;
    if (returnFocus) menuTrigger?.focus();
    menuTrigger = null;
  }

  function showPrototypeMessage() {
    clearTimeout(toastTimer);
    toast.textContent = 'Ukázková akce — prototyp nic neukládá ani nemění.';
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  Object.values(controls).forEach(control => control.addEventListener('change', () => {
    document.documentElement.classList.toggle('dark', controls.theme.value === 'dark');
    document.documentElement.dataset.palette = controls.palette.value;
    document.documentElement.classList.toggle('text-zoom', controls.zoom.checked);
    workspace.style.setProperty('--workspace-width', `${controls.width.value}px`);
    render();
  }));

  collection.addEventListener('click', event => {
    const more = event.target.closest('[data-more], .menu-link-trigger');
    if (more) { event.stopPropagation(); openMore(more.dataset.more || more.dataset.giftId, more); return; }
    if (event.target.closest('[data-demo-action]')) { event.stopPropagation(); showPrototypeMessage(); return; }
    if (event.target.closest('a')) return;
    const card = event.target.closest('.gift-card'); if (card) openDetail(card.dataset.giftId);
  });
  collection.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('gift-card')) { event.preventDefault(); openDetail(event.target.dataset.giftId); }
    if (event.key === 'ArrowDown' && event.target.matches('[data-more]')) { event.preventDefault(); openMore(event.target.dataset.more, event.target); }
  });
  morePopover.addEventListener('click', event => {
    if (event.target.closest('[data-demo-action]')) { showPrototypeMessage(); closeMore(); }
    if (event.target.closest('[data-detail-action]')) { const id = menuTrigger?.dataset.more || menuTrigger?.dataset.giftId; closeMore(false); if (id) openDetail(id); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !morePopover.hidden) { event.preventDefault(); closeMore(); } });
  document.addEventListener('click', event => { if (!morePopover.hidden && !morePopover.contains(event.target) && !event.target.closest('[data-more], .menu-link-trigger')) closeMore(false); });
  document.querySelectorAll('[data-demo-action]').forEach(button => button.addEventListener('click', showPrototypeMessage));
  window.addEventListener('resize', syncCollectionTracks);
  render();
})();
