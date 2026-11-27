(() => {
	const P = window.P;
	const latin =
		'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
	const latinExtended =
		'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

	const loadFonts = async () => {
		const faces = Object.entries(P.assets.fonts).map(([name, source]) => {
			const [family, subset, weight] = name.split(' ');
			return new FontFace(family, `url(${source})`, {
				weight: weight ?? '100 900',
				unicodeRange: subset === 'latin' ? latin : latinExtended,
			});
		});
		await Promise.all(faces.map((face) => face.load()));
		for (const face of faces) {
			document.fonts.add(face);
		}
	};

	const canvas = document.getElementById('film');
	const context = canvas.getContext('2d');
	const parameters = new URLSearchParams(location.search);

	P.ready = (async () => {
		await loadFonts();
		P.initTextures();
		P.cues = P.assets.cuesData ?? (await (await fetch(P.assets.cues)).json());
		P.prepare?.();
	})();

	window.renderAt = async (time) => {
		await P.ready;
		P.render(context, time);
	};
	window.frameData = async (time, type = 'image/png', quality = 0.95) => {
		await window.renderAt(time);
		return canvas.toDataURL(type, quality);
	};

	const playButton = document.getElementById('play');
	const still = parameters.get('t');
	P.ready.then(() => {
		if (parameters.has('gallery')) {
			playButton.hidden = true;
			P.gallery(context, Number(parameters.get('gallery')) || 0, Number(still) || 0);
			return;
		}
		if (still !== null) {
			playButton.hidden = true;
			P.render(context, Number(still));
			return;
		}
		P.render(context, 0);
		const audio = new Audio(P.assets.audio);
		audio.preload = 'auto';
		let playing = false;
		const tick = () => {
			if (!playing) {
				return;
			}
			P.render(context, audio.currentTime);
			requestAnimationFrame(tick);
		};
		playButton.addEventListener('click', async () => {
			playButton.hidden = true;
			audio.currentTime = 0;
			await audio.play();
			playing = true;
			requestAnimationFrame(tick);
		});
		audio.addEventListener('ended', () => {
			playing = false;
			P.render(context, P.duration);
			playButton.hidden = false;
			playButton.setAttribute('aria-label', playButton.dataset.replayLabel);
		});
	});

	/* Contact sheet of every sprite, for art review. */
	P.gallery = (galleryContext, page, time) => {
		const A = P.art;
		const C = P.C;
		const items = [
			() => A.giftBody(C.sky, C.sun, 'dots'),
			() => A.giftLid(C.sky, C.sun, 'dots'),
			() => A.scarf(),
			() => A.mug(),
			() => A.sock(),
			() => A.target(),
			() => A.arrow(),
			() => A.scissors(0.6),
			() => A.cloud(320),
			() => A.sun(),
			() => A.house(),
			() => A.logoMark(),
			() => A.letter('ř'),
			() => A.headphones(),
			() => A.book(),
			() => A.plant(),
			() => A.teapot(),
			() => A.teddy(),
			() => A.kite(),
			() => A.tape(),
			() => A.priceTag(),
			() => A.linkChip(),
			() => A.stickyNote(),
			() => A.paperPlane(),
			() => A.phone(),
			() => A.registrationCard(),
			() => A.badge(),
			() => A.stampTool(),
			() => A.stampMark(),
			() => A.card('headphones', 'Sluchátka', '1 290 Kč'),
			() => A.speechBubble(),
			() => A.balloon(),
			() => A.heart(),
			() => A.sparkle(),
			() => A.banner(),
			() => A.cake(),
			() => A.christmasTree(),
			() => A.weddingRings(),
			() => A.daisy(),
			() => A.paintChip(C.sakura),
			() => A.brush(C.sakura),
			() => A.polaroid(),
			() => A.priorityStar(true),
			() => A.priorityStar(false),
			() => A.chip('High'),
			() => A.counter(),
			() => A.heartOutline(),
			() => A.emptySlot(),
			() => A.pencilTool(),
			() => A.chatBubble(C.mintPale, 'a'),
			() => A.envelope(),
			() => A.bell(),
			() => A.notification('Someone reserved a gift you like'),
			() => A.ticket('Invite'),
			() => A.rosette(),
			() => A.heightChart(),
			() => A.checkBadge(),
			() => A.pocketBack(),
			() => A.pocketFront('Received'),
			() => A.pocketFlap(),
			() => A.adSign(),
			() => A.magnifier(),
		];
		galleryContext.fillStyle = P.paperFill(galleryContext, C.skyPale);
		galleryContext.fillRect(0, 0, P.W, P.H);
		const perPage = 18;
		const columns = 6;
		items.slice(page * perPage, page * perPage + perPage).forEach((make, index) => {
			const sprite = make();
			const cellWidth = P.W / columns;
			const cellHeight = P.H / 3;
			const x = (index % columns) * cellWidth + cellWidth / 2;
			const y = Math.floor(index / columns) * cellHeight + cellHeight / 2;
			const scale = Math.min(
				(cellWidth - 30) / sprite.width,
				(cellHeight - 30) / sprite.height,
				1.2,
			);
			P.draw(galleryContext, sprite, x, y, { scale, time });
		});
		if (page === Math.ceil(items.length / perPage)) {
			P.puppet(
				galleryContext,
				'jana',
				300,
				1000,
				{ expression: 'smile' },
				{ scale: 0.75, time },
			);
			P.puppet(
				galleryContext,
				'grandma',
				760,
				1000,
				{ expression: 'grin', leftHand: [-60, -300], rightHand: [120, -120] },
				{ scale: 0.75, time },
			);
			P.puppet(
				galleryContext,
				'friend',
				1220,
				1000,
				{
					expression: 'forced',
					armsInFront: true,
					leftHand: [-44, -372],
					rightHand: [44, -372],
				},
				{ scale: 0.75, time },
			);
			P.puppet(
				galleryContext,
				'aunt',
				1560,
				1000,
				{ expression: 'oh', look: 1 },
				{ scale: 0.75, time },
			);
			P.puppet(
				galleryContext,
				'rosie',
				1820,
				1000,
				{ expression: 'grin', headScale: 1.3 },
				{ scale: 0.45, time },
			);
		}
	};
})();
