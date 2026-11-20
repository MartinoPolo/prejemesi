/* The film: nine collage scenes driven by the named marks in cues.json. */
(() => {
	const P = window.P;
	const C = P.C;
	const A = P.art;
	const S = P.shape;
	const E = P.ease;
	const W = P.W;
	const H = P.H;
	const {
		ramp,
		settle,
		between,
		bounce,
		shakeAt,
		arcPath,
		popOptions,
		drawPop,
		skyBackground,
		confetti,
		sparkleBurst,
		drawTown,
		drawWordmark,
		sheetShadow,
		wallSprite,
		tableSprite,
		frameSprite,
	} = P.stage;
	let M = {};
	let oldWorld;
	let oldContext;

	/* ---------- scene 1+2: the duplicate world (drawn desaturated) ---------- */
	const pile = [
		{
			make: () => A.giftBody(C.coral, C.white, 'stripes'),
			y: 0,
			x: 0,
			scale: 0.72,
			rotation: 0.02,
		},
		{ make: () => A.sock(C.mintPale, 'a'), y: -135, x: -10, scale: 0.62, rotation: 1.5 },
		{ make: () => A.mug(C.creamDark), y: -212, x: 12, scale: 0.62, rotation: -0.04 },
		{ make: () => A.scarf(C.sky, C.white, 'b'), y: -288, x: -8, scale: 0.44, rotation: 0.06 },
		{ make: () => A.mug(C.creamDark), y: -362, x: 6, scale: 0.6, rotation: 0.05 },
		{ make: () => A.sock(C.mintPale, 'a'), y: -462, x: -4, scale: 0.55, rotation: -1.45 },
		{ make: () => A.mug(C.creamDark), y: -535, x: 10, scale: 0.55, rotation: -0.08 },
	];

	const drawDuplicateWorld = (context, time) => {
		const pan = -1180 * ramp(time, M.pan, 1.0, E.inOutCubic);
		const [shakeX, shakeY] = shakeAt(time, M.arrowHit, 12, 0.4);
		context.save();
		context.translate(shakeX, shakeY);
		P.draw(context, wallSprite(), W * 1.1 + pan * 0.9, H / 2, { shadowAlpha: 0, time });
		P.draw(context, frameSprite(), 1420 + pan * 0.9, 250, { rotation: 0.03, time, scale: 0.9 });
		const bunting = A.bunting(1700);
		const buntingDrop = settle(time, 0.05, 1.6, 4) * 170 - 170;
		P.draw(context, bunting, 860 + pan * 0.95, 80 + buntingDrop, {
			shadowAlpha: 0.2,
			rotation: Math.sin(time * 1.3) * 0.006,
			time,
		});
		const banner = popOptions(time, 0.45, { rotation: -0.03 });
		if (banner) {
			P.draw(context, A.banner(), 860 + pan * 0.95, 250, {
				...banner,
				scale: banner.scale * 0.9,
			});
		}
		context.translate(pan, 0);

		/* Jana behind the table */
		const janaIn = settle(time, 0.25, 1.8, 6);
		const expression = time < M.giftOne + 0.25 ? 'grin' : time < M.forced ? 'oh' : 'forced';
		const lookDirection = between(time, M.giftOne + 0.1, M.tally + 0.4)
			? -1
			: between(time, M.giftTwo, M.forced + 0.6)
				? 1
				: 0;
		const janaPose = {
			expression,
			look: lookDirection,
			headTilt:
				time > M.forced ? -0.12 + Math.sin(time * 3) * 0.02 : Math.sin(time * 2.2) * 0.04,
			bob: Math.sin(time * 3.1) * 4,
			blink: Math.max(0, 1 - Math.abs(((time + 0.4) % 3.1) - 0.08) * 12),
			leftHand: time > M.forced ? [-80, -250] : [-170, -30],
			rightHand: time > M.giftTwo ? [150, -120] : [178, -20],
		};
		P.puppet(context, 'jana', 700, 1180 - janaIn * 250, janaPose, { scale: 1.05, time });

		P.draw(context, tableSprite(), W * 1.1, 900, { shadowAlpha: 0.25, time });

		/* existing scarves on the table */
		const scarfPile = [
			[300, 790, -0.08, C.coral],
			[310, 760, 0.1, C.coral],
		];
		scarfPile.forEach(([x, y, rotation, color], index) => {
			const pop = popOptions(time, 0.55 + index * 0.12, { rotation });
			if (pop) {
				P.draw(context, A.scarf(color, C.sunPale, 'a'), x, y, {
					...pop,
					scale: pop.scale * 0.55,
				});
			}
		});

		/* gift one: scarf */
		const giftOneLid = ramp(time, M.giftOne - 0.05, 0.55, E.outCubic);
		A.drawGift(context, 1130, 780, {
			color: C.sky,
			ribbon: C.sun,
			key: 'dots',
			scale: 0.85,
			time,
			lidLift: giftOneLid * 1500,
			lidRotation: -giftOneLid * 1.4,
			alpha: 1,
		});
		if (time >= M.giftOne) {
			const flight = ramp(time, M.giftOne, 0.5, E.outQuad);
			const [x, y] = arcPath([1130, 700], [305, 735], 420, flight);
			const landing = settle(time, M.giftOne + 0.5, 3, 7);
			P.draw(context, A.scarf(C.coral, C.sunPale, 'a'), x, y, {
				scale:
					0.55 *
					(flight < 1 ? 0.6 + flight * 0.4 : 1) *
					(1 + (1 - landing) * 0.05 * (flight >= 1)),
				rotation: (1 - flight) * -4 + 0.02,
				lift: 1 - flight,
				time,
			});
		}
		if (time >= M.tally) {
			P.handText(context, '3×', 300, 620, {
				size: 130,
				reveal: ramp(time, M.tally, 0.35, E.outQuad),
				time,
				rotation: -0.08,
				color: C.ink,
			});
			const circle = S.ellipse(318, 580, 120, 80, 40, -0.1).concat([[440, 560]]);
			P.drawOn(context, circle, ramp(time, M.tally + 0.3, 0.4), {
				width: 5,
				seed: 5,
				color: C.ink,
			});
		}

		/* gift two: identical mug */
		const giftTwoLid = ramp(time, M.giftTwo - 0.05, 0.55, E.outCubic);
		A.drawGift(context, 1430, 790, {
			color: C.sakura,
			ribbon: C.white,
			key: 'stripes',
			scale: 0.8,
			time,
			lidLift: giftTwoLid * 1500,
			lidRotation: giftTwoLid * 1.2,
		});
		const existingMug = popOptions(time, 0.7);
		if (existingMug) {
			P.draw(context, A.mug(), 1760, 730, {
				...existingMug,
				scale: existingMug.scale * 0.85,
			});
		}
		if (time >= M.giftTwo) {
			const flight = ramp(time, M.giftTwo, M.mugLand - M.giftTwo, E.outQuad);
			const [x, y] = arcPath([1430, 700], [1560, 730], 300, flight);
			const squash = flight >= 1 ? settle(time, M.mugLand, 3.5, 7) : 1;
			P.draw(context, A.mug(), x, y, {
				scale: 0.85,
				scaleY: 0.75 + squash * 0.25,
				rotation: (1 - flight) * 3,
				lift: 1 - flight,
				time,
				anchorY: 0.5,
			});
		}
		if (time >= M.equals) {
			const reveal = ramp(time, M.equals, 0.25, E.outQuad);
			P.drawOn(
				context,
				[
					[1620, 560],
					[1700, 556],
				],
				reveal * 2,
				{ width: 7, seed: 11 },
			);
			P.drawOn(
				context,
				[
					[1622, 594],
					[1702, 590],
				],
				reveal * 2 - 1,
				{ width: 7, seed: 12 },
			);
		}

		/* scene 2: tower of duplicates + the heart arrow that misses */
		const towerX = 2180;
		const towerBase = 820;
		const wobbleAmount = P.clamp((time - M.pan) / 2.5) * 0.035;
		const towerWobble = Math.sin((time - M.pan) * 6.5) * wobbleAmount;
		pile.forEach((item, index) => {
			const appear = popOptions(time, M.pan + 0.35 + index * 0.1, {
				rotation: item.rotation,
			});
			if (!appear) {
				return;
			}
			let x = towerX + item.x + Math.sin(towerWobble) * -item.y;
			let y = towerBase + item.y;
			let rotation = appear.rotation + towerWobble;
			if (time > M.topple) {
				const fall = time - M.topple - index * 0.035;
				if (fall > 0) {
					const direction = index % 2 ? 1 : -1;
					x += fall * (240 + index * 90) * (index > 2 ? 1 : direction * 0.6);
					y += 1400 * fall * fall - fall * (60 + index * 30);
					rotation += fall * (3 + index) * (index % 2 ? 1 : -1);
				}
			}
			P.draw(context, item.make(), x, y, {
				...appear,
				scale: appear.scale * item.scale,
				rotation,
			});
		});
		P.draw(context, A.target(), 2830, 540, {
			scale: 0.95,
			time,
			rotation:
				time > M.arrowHit
					? Math.sin((time - M.arrowHit) * 30) * 0.03 * Math.exp(-(time - M.arrowHit) * 5)
					: 0,
		});
		if (time >= M.arrowLaunch) {
			const flight = ramp(time, M.arrowLaunch, M.arrowHit - M.arrowLaunch, E.inQuad);
			const target = [2690, 395];
			const start = [1300, 330];
			const [x, y] = arcPath(start, target, 150, flight);
			const heading =
				flight < 1
					? Math.atan2(
							target[1] - start[1] - Math.cos(Math.PI * flight) * Math.PI * 150,
							target[0] - start[0],
						)
					: 0.12;
			const quiver =
				time > M.arrowHit
					? Math.sin((time - M.arrowHit) * 55) * 0.08 * Math.exp(-(time - M.arrowHit) * 6)
					: 0;
			P.draw(context, A.arrow(), x, y, {
				rotation: heading + quiver,
				scale: 0.9,
				time,
				anchorX: 0.93,
				lift: 0.3,
			});
			if (time > M.arrowHit) {
				P.handText(context, 'vedle!', 2560, 250, {
					size: 84,
					reveal: ramp(time, M.arrowHit + 0.08, 0.3),
					time,
					rotation: -0.12,
				});
			}
		}
		context.restore();
	};

	const drawOldWorld = (time) => {
		oldContext.save();
		oldContext.clearRect(0, 0, W, H);
		drawDuplicateWorld(oldContext, time);
		oldContext.restore();
	};

	const drawMutedImage = (context) => {
		context.save();
		context.filter = 'saturate(0.38) sepia(0.28) contrast(0.96) brightness(1.01)';
		context.drawImage(oldWorld, 0, 0);
		context.restore();
	};

	/* ---------- transition: scissors cut the old world open ---------- */
	const cutY = (x) => 540 + Math.sin(x / 190) * 26 + Math.sin(x / 57) * 5;
	const cutLine = (() => {
		const points = [];
		for (let x = -40; x <= W + 40; x += 14) {
			points.push([x, cutY(x) + (P.hash(x, 3) - 0.5) * 3]);
		}
		return points;
	})();

	const drawScissorsTransition = (context, time) => {
		const travel = ramp(time, M.scissors, M.split - M.scissors, (x) => x);
		const cutX = P.lerp(-160, W + 200, travel);
		const split = ramp(time, M.split, 0.38, E.inQuad);
		const halves = [
			{
				polygon: [[-60, -60], [W + 60, -60], ...cutLine.slice().reverse()],
				dy: -760 * split,
				rotation: -0.06 * split,
			},
			{
				polygon: [...cutLine, [W + 60, H + 60], [-60, H + 60]],
				dy: 820 * split,
				rotation: 0.05 * split,
			},
		];
		for (const half of halves) {
			context.save();
			context.translate(W / 2, H / 2 + half.dy);
			context.rotate(half.rotation);
			context.translate(-W / 2, -H / 2);
			if (split > 0) {
				context.shadowColor = 'rgba(22,40,70,0.35)';
				context.shadowBlur = 24;
				context.shadowOffsetY = 10;
				P.tracePath(context, half.polygon);
				context.fillStyle = C.paper;
				context.fill();
				context.shadowColor = 'transparent';
			}
			P.tracePath(context, half.polygon);
			context.clip();
			drawMutedImage(context);
			context.restore();
		}
		if (split === 0 && cutX > -40) {
			const cutSoFar = cutLine.filter(([x]) => x < cutX);
			if (cutSoFar.length > 1) {
				context.save();
				context.lineCap = 'round';
				context.strokeStyle = C.paper;
				context.lineWidth = 7;
				P.tracePath(context, cutSoFar, false);
				context.stroke();
				context.strokeStyle = 'rgba(22,56,92,0.45)';
				context.lineWidth = 2;
				context.setLineDash([2, 10]);
				P.tracePath(context, cutSoFar, false);
				context.stroke();
				context.restore();
			}
		}
		if (time < M.split + 0.35) {
			const snips = [M.snipOne, M.snipTwo, M.snipThree];
			const since = Math.min(
				...snips.map((snip) => (time >= snip - 0.18 ? Math.abs(time - snip) : 9)),
			);
			const openAmount = P.clamp(since / 0.18);
			const exit = ramp(time, M.split, 0.35, E.inQuad);
			const x = cutX + exit * 400;
			const angle = Math.atan2(cutY(x + 20) - cutY(x - 20), 40);
			P.draw(context, A.scissors(Math.round(openAmount * 5) / 5), x + 150, cutY(x), {
				rotation: angle,
				scale: 1.05,
				time,
				lift: 0.6,
				anchorX: 0.64,
			});
		}
	};

	/* ---------- scene 3: the logo ---------- */
	const drawLogoScene = (context, time) => {
		skyBackground(context, time);
		const exit = ramp(time, M.notebook - 0.15, 0.4, E.inBack);
		context.save();
		context.translate(0, -exit * 900);
		drawWordmark(context, time, M.logo, {
			x: W / 2,
			y: 520,
			lettersDelay: M.letters - M.logo,
		});
		sparkleBurst(context, time, M.letters, W / 2, 520, { count: 10, radius: 700, seed: 3 });
		context.restore();
	};

	/* ---------- scene 4: writing the wishlist ---------- */
	const notebookRows = [
		{
			key: 'headphones',
			make: () => A.headphones(),
			label: 'Sluchátka',
			y: -165,
			scale: 0.5,
			at: () => M.rowOne,
			picture: () => M.picture,
		},
		{
			key: 'book',
			make: () => A.book(),
			label: 'Kniha o hvězdách',
			price: '349 Kč',
			y: 70,
			scale: 0.56,
			at: () => M.rowTwo,
			picture: () => M.rowTwo + 0.1,
		},
		{
			key: 'plant',
			make: () => A.plant(),
			label: 'Monstera',
			price: '590 Kč',
			y: 280,
			scale: 0.56,
			at: () => M.rowThree,
			picture: () => M.rowThree + 0.1,
		},
	];

	const drawNotebook = (context, time, { x, y, rotation = 0, scale = 1 }) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(scale, scale);
		P.draw(context, A.notebook(), 0, 0, { time, shadowAlpha: 0.3 });
		P.handText(context, 'Moje přání', -250, -330, {
			size: 104,
			reveal: ramp(time, M.title, 0.7, E.outQuad),
			time,
			color: C.deep,
		});
		if (time > M.title + 0.55) {
			P.drawOn(
				context,
				S.bezier(
					[
						[-250, -305],
						[-120, -290],
						[60, -300],
						[150, -312],
					],
					20,
				),
				ramp(time, M.title + 0.55, 0.3),
				{ width: 5, seed: 31, color: C.sakura },
			);
		}
		notebookRows.forEach((row, index) => {
			const writeDuration = index === 0 ? 0.6 : 0.35;
			if (time < row.at()) {
				return;
			}
			drawPop(context, row.make(), -205, row.y, time, row.picture(), {
				scale: row.scale,
				rotation: (index - 1) * 0.06,
			});
			P.handText(context, row.label, -110, row.y + 22, {
				size: index === 0 ? 84 : 70,
				reveal: ramp(time, row.at(), writeDuration, E.outQuad),
				time,
			});
			if (row.price) {
				P.handText(context, row.price, -110, row.y + 90, {
					size: 54,
					reveal: ramp(time, row.at() + 0.2, 0.3),
					time,
					color: C.deep,
				});
			}
		});
		drawPop(context, A.linkChip(), -10, -70, time, M.link, { scale: 0.72, rotation: -0.04 });
		if (time > M.price) {
			const slap = popOptions(time, M.price, { rotation: 0.07 });
			P.draw(context, A.priceTag(), 230, -72, { ...slap, scale: slap.scale * 0.78 });
			const tape = settle(time, M.price + 0.08, 3, 8);
			P.draw(context, A.tape(120, 'rgba(255,233,168,0.85)', 'price'), 140, -100, {
				rotation: -0.7,
				scale: tape,
				time,
				shadowAlpha: 0.1,
			});
		}
		context.restore();
	};

	const drawKidsPage = (context, time, { x, y, rotation, scale }) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(scale, scale);
		const page = P.sprite('kids-page', 620, 700, (spriteContext) => {
			A.part(spriteContext, S.rect(-300, -340, 600, 680), '#fff3dc', { seed: 851, shade: 0 });
			for (let index = 0; index < 5; index++) {
				const star = S.star(-230 + index * 115, 300 - (index % 2) * 20, 22, 9);
				A.part(spriteContext, star, [C.sun, C.sky, C.coral, C.mint, C.sakura][index], {
					seed: 852 + index,
					line: 2,
					cut: false,
				});
			}
		});
		P.draw(context, page, 0, 0, { time });
		P.draw(context, A.tape(150, 'rgba(159,220,191,0.8)', 'kids'), 0, -335, {
			rotation: 0.05,
			time,
			shadowAlpha: 0.1,
		});
		P.handText(context, 'Pro Toníka', -220, -220, {
			size: 96,
			reveal: ramp(time, M.kidsPage + 0.2, 0.5),
			time,
			color: C.coral,
		});
		drawPop(context, A.teddy(), -130, 20, time, M.teddy, { scale: 0.75, rotation: -0.08 });
		drawPop(context, A.kite(), 150, -10, time, M.kite, { scale: 0.62, rotation: 0.12 });
		context.restore();
	};

	const drawWishlistScene = (context, time, { background = true } = {}) => {
		if (background) {
			skyBackground(context, time, { sun: false });
		}
		const enter = settle(time, M.notebook, 1.5, 6);
		const shiftLeft = ramp(time, M.kidsPage, 0.45, E.inOutCubic);
		const fold = ramp(time, M.fold, 0.45, E.inCubic);
		const notebookX = P.lerp(960, 700, shiftLeft);
		const notebookY = P.lerp(1700, 560, enter);
		if (fold < 1) {
			context.save();
			context.translate(notebookX, notebookY);
			context.scale(1 - fold * 0.95, 1 - fold * 0.7);
			context.rotate(fold * 0.6);
			context.translate(-notebookX, -notebookY);
			drawNotebook(context, time, {
				x: notebookX,
				y: notebookY,
				rotation: -0.025 + Math.sin(time * 0.9) * 0.004,
				scale: 1,
			});
			context.restore();
		}
		if (time >= M.kidsPage) {
			const slide = settle(time, M.kidsPage, 1.8, 6.5);
			const leave = ramp(time, M.fold - 0.05, 0.35, E.inBack);
			drawKidsPage(context, time, {
				x: P.lerp(2400, 1420, slide) + leave * 1100,
				y: 560 + leave * -200,
				rotation: 0.07 + leave * 0.5,
				scale: 0.9,
			});
		}
	};

	/* ---------- scene 5: share the link ---------- */
	const friends = [
		{ name: 'grandma', x: 400, at: () => M.grandma, appear: 0, accent: C.sakura },
		{ name: 'friend', x: 960, at: () => M.friend, appear: 0.14, accent: C.mint },
		{ name: 'aunt', x: 1520, at: () => M.aunt, appear: 0.28, accent: '#efa00b' },
	];
	const phonePosition = (friend) => [friend.x + 140, 830];
	const planePath = S.bezier(
		[
			[700, 560],
			[520, 250],
			[180, 180],
			[330, 420],
			[480, 640],
			[900, 420],
			[960, 260],
		],
		40,
	);

	const drawShareScene = (context, time) => {
		skyBackground(context, time, { sunX: 1700, sunY: 170 });
		drawTown(context, time, settle(time, M.fold, 1.6, 6));
		if (time >= M.fold) {
			drawWishlistScene(context, time, { background: false });
		}

		/* friends pop up holding phones */
		friends.forEach((friend, index) => {
			const rise = settle(time, M.fold + 1.15 + friend.appear, 1.9, 6);
			if (rise <= 0) {
				return;
			}
			const ding = time - friend.at();
			const pose = {
				expression: ding > 0 ? 'grin' : 'smile',
				look: index === 0 ? 1 : index === 2 ? -1 : 0,
				headTilt:
					Math.sin(time * 2 + index) * 0.05 +
					(ding > 0 && ding < 0.4 ? Math.sin(ding * 20) * 0.06 : 0),
				bob: Math.sin(time * 3 + index * 1.7) * 5,
				rightHand: [150, -200],
				rightGrip: true,
				leftHand: [-176, -14],
				prop: (layerContext, hands) =>
					P.draw(
						layerContext,
						A.phone(friend.accent, friend.name),
						hands.rightHand[0] + 34,
						hands.rightHand[1] - 62,
						{ scale: 0.62, rotation: 0.14, time, shadowAlpha: 0.15 },
					),
			};
			P.puppet(context, friend.name, friend.x, 1300 - rise * 260, pose, {
				scale: 0.78,
				time,
			});
			if (ding > 0 && ding < 0.9) {
				const [x, y] = phonePosition(friend).map((value, axis) => value + (axis ? 100 : 0));
				const burst = E.outCubic(P.clamp(ding / 0.5));
				context.save();
				context.globalAlpha = 1 - P.clamp((ding - 0.4) / 0.5);
				for (let ray = 0; ray < 8; ray++) {
					const angle = (ray / 8) * Math.PI * 2;
					P.pencil(
						context,
						[
							[
								x + Math.cos(angle) * (60 + burst * 40),
								y - 100 + Math.sin(angle) * (60 + burst * 40),
							],
							[
								x + Math.cos(angle) * (90 + burst * 70),
								y - 100 + Math.sin(angle) * (90 + burst * 70),
							],
						],
						{ width: 5, color: C.deep, seed: ray, gaps: false },
					);
				}
				context.restore();
			}
		});

		/* paper plane: one flight, then three little planes to the phones */
		const fold = ramp(time, M.fold + 0.25, 0.25);
		if (time >= M.fold + 0.25 && time < M.grandma + 1.2) {
			const flight = ramp(time, M.planeFly, M.grandma - 0.25 - M.planeFly, E.inOutSine);
			const splitTime = M.grandma - 0.25;
			if (time < splitTime) {
				const index = Math.min(
					planePath.length - 2,
					Math.floor(flight * (planePath.length - 1)),
				);
				const [x, y] = planePath[index];
				const [nextX, nextY] = planePath[index + 1];
				context.save();
				context.setLineDash([14, 14]);
				context.strokeStyle = C.deep;
				context.lineWidth = 4;
				context.lineCap = 'round';
				P.tracePath(context, planePath.slice(0, index + 1), false);
				context.stroke();
				context.restore();
				P.draw(context, A.paperPlane(), x, y, {
					scale: 0.7 * fold,
					rotation: Math.atan2(nextY - y, nextX - x),
					time,
					lift: 0.8,
				});
			}
		}
		if (time >= M.grandma - 0.25) {
			friends.forEach((friend, index) => {
				const start = M.grandma - 0.25;
				const arrive = friend.at();
				const amount = ramp(time, start, arrive - start, E.inOutSine);
				const [targetX, targetY] = phonePosition(friend);
				const from = [960, 260];
				const to = [targetX, targetY - 90];
				const [x, y] = arcPath(from, to, 120, amount);
				const trail = [];
				for (let step = 0; step <= 24; step++) {
					trail.push(arcPath(from, to, 120, (step / 24) * amount));
				}
				context.save();
				context.globalAlpha = 1 - P.clamp((time - arrive - 0.5) / 0.5);
				context.setLineDash([14, 14]);
				P.tracePath(context, trail, false);
				context.strokeStyle = C.deep;
				context.lineWidth = 4;
				context.lineCap = 'round';
				context.stroke();
				context.restore();
				if (amount < 1) {
					const [nextX, nextY] = arcPath(from, to, 120, Math.min(1, amount + 0.02));
					P.draw(context, A.paperPlane(), x, y, {
						scale: 0.42,
						rotation: Math.atan2(nextY - y, nextX - x),
						time,
						lift: 0.6,
					});
				}
				void index;
			});
		}

		/* no registration needed */
		if (time >= M.registration) {
			const drop = settle(time, M.registration, 1.8, 6.5);
			const cardY = P.lerp(-300, 330, drop);
			P.draw(context, A.registrationCard(), 960, cardY, {
				scale: 0.95,
				rotation: -0.03,
				time,
				lift: 1 - drop,
			});
			if (time >= M.crossOut) {
				const cross = ramp(time, M.crossOut, 0.35, E.outQuad);
				P.drawOn(
					context,
					[
						[760, cardY - 110],
						[1160, cardY + 120],
					],
					cross * 2,
					{ width: 10, color: C.coral, seed: 51 },
				);
				P.drawOn(
					context,
					[
						[1160, cardY - 110],
						[760, cardY + 120],
					],
					cross * 2 - 1,
					{ width: 10, color: C.coral, seed: 52 },
				);
			}
			if (time >= M.badge) {
				const local = time - M.badge;
				const slam =
					local < 0.12
						? P.lerp(2.4, 1, E.inQuad(local / 0.12))
						: 1 - (1 - P.spring(local - 0.12, 3, 7)) * 0.1;
				P.draw(context, A.badge(), 1250, cardY + 110, {
					scale: slam * 0.82,
					rotation: 0.18,
					lift: P.clamp(1 - local / 0.12),
					time,
				});
			}
		}
	};

	/* ---------- scene 6: reservations ---------- */
	const cardItems = [
		{
			key: 'headphones',
			make: () => A.headphones(),
			label: 'Sluchátka',
			price: '1 290 Kč',
			scale: 0.62,
		},
		{ key: 'book', make: () => A.book(), label: 'Kniha', price: '349 Kč', scale: 0.62 },
		{ key: 'plant', make: () => A.plant(), label: 'Monstera', price: '590 Kč', scale: 0.6 },
		{ key: 'teapot', make: () => A.teapot(), label: 'Konvička', price: '720 Kč', scale: 0.58 },
	];
	const drawCard = (
		context,
		item,
		x,
		y,
		{ scale = 1, rotation = 0, time, lift = 0, stamped = null, alpha = 1 },
	) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(scale, scale);
		context.globalAlpha = alpha;
		P.draw(context, A.card(item.key, item.label, item.price), 0, 0, { time, lift });
		P.draw(context, item.make(), 0, -60, { scale: item.scale, time, shadowAlpha: 0.2 });
		if (stamped !== null && stamped >= 0) {
			const impact = P.clamp(stamped / 0.08);
			P.draw(context, A.stampMark(), 0, 20, {
				scale: (1.25 - impact * 0.25) * 0.66,
				rotation: -0.2,
				alpha: impact * 0.92,
				time,
				shadowAlpha: 0,
			});
		}
		context.restore();
	};

	const cardSlots = [
		[300, 610, -0.05],
		[740, 590, 0.03],
		[1180, 615, -0.02],
		[1620, 595, 0.05],
	];

	const stampMoves = [
		{ who: 'grandma', card: 0, hit: () => M.stampOne, angle: 0.25 },
		{ who: 'friend', card: 1, hit: () => M.stampTwo, angle: -0.1 },
		{ who: 'aunt', card: 2, hit: () => M.stampThree, angle: -0.3 },
	];

	const stampHandPosition = (time, slot, hit, angle) => {
		const [slotX, slotY] = cardSlots[slot];
		const hover = [slotX + 20, slotY - 330];
		const impact = [slotX, slotY - 150];
		const offscreen = [slotX + Math.sin(angle) * -900, -700];
		if (time < hit - 0.42) {
			return null;
		}
		if (time < hit - 0.12) {
			const amount = ramp(time, hit - 0.42, 0.3, E.outCubic);
			return [P.lerp(offscreen[0], hover[0], amount), P.lerp(offscreen[1], hover[1], amount)];
		}
		if (time < hit) {
			const amount = ramp(time, hit - 0.12, 0.12, E.inQuad);
			return [P.lerp(hover[0], impact[0], amount), P.lerp(hover[1], impact[1], amount)];
		}
		if (time < hit + 0.2) {
			return impact;
		}
		const amount = ramp(time, hit + 0.2, 0.4, E.inCubic);
		if (amount >= 1) {
			return null;
		}
		return [P.lerp(impact[0], offscreen[0], amount), P.lerp(impact[1], offscreen[1], amount)];
	};

	const holdStamp = (time) => (context) =>
		P.draw(context, A.stampTool(), 0, 88, { scale: 0.8, time, shadowAlpha: 0.2 });

	const drawReserveScene = (context, time) => {
		context.fillStyle = P.paperFill(context, '#f4f8fb');
		context.fillRect(0, 0, W, H);
		context.save();
		context.globalAlpha = 0.5;
		context.strokeStyle = 'rgba(85,185,243,0.35)';
		context.lineWidth = 2;
		for (let x = 0; x < W; x += 60) {
			context.beginPath();
			context.moveTo(x, 0);
			context.lineTo(x, H);
			context.stroke();
		}
		for (let y = 0; y < H; y += 60) {
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(W, y);
			context.stroke();
		}
		context.restore();
		const [shakeX, shakeY] = [M.stampOne, M.stampTwo, M.stampThree].reduce(
			(sum, hit) => {
				const [x, y] = shakeAt(time, hit, 7, 0.25);
				return [sum[0] + x, sum[1] + y];
			},
			[0, 0],
		);
		context.save();
		context.translate(shakeX, shakeY);
		const stampedAt = [M.stampOne, M.stampTwo, M.stampThree, null];
		cardItems.forEach((item, index) => {
			const [x, y, rotation] = cardSlots[index];
			const pop = popOptions(time, M.cards + index * 0.09, { rotation });
			if (!pop) {
				return;
			}
			const blocked = index === 0 ? time - M.blocked : -1;
			const wiggle =
				blocked > 0 && blocked < 0.5
					? Math.sin(blocked * 40) * 0.05 * (1 - blocked / 0.5)
					: 0;
			const stamped = stampedAt[index] === null ? null : time - stampedAt[index];
			drawCard(context, item, x, y, {
				scale: pop.scale * 1.1,
				rotation: pop.rotation + wiggle,
				time,
				lift: pop.lift,
				stamped,
			});
		});

		/* aunt reaches for the headphones, already taken, and changes her mind */
		if (time >= M.reach && time < M.stampThree - 0.42) {
			const toward = ramp(time, M.reach, M.blocked - M.reach, E.outCubic);
			const recoil = ramp(time, M.blocked, 0.3, E.outBack);
			const [slotX, slotY] = cardSlots[0];
			const x = P.lerp(slotX + 700, slotX + 60, toward) + recoil * 180;
			const y = P.lerp(-700, slotY - 320, toward) - recoil * 60;
			P.reachingArm(context, 'aunt', x, y, -0.55 + recoil * 0.1, {
				time,
				hold: holdStamp(time),
			});
			if (time > M.blocked) {
				P.handText(context, 'už je zamluveno', slotX - 190, slotY - 330, {
					size: 58,
					reveal: ramp(time, M.blocked, 0.25),
					time,
					rotation: -0.06,
					color: C.deep,
				});
			}
		}
		if (time > M.blocked + 0.2) {
			const [fromX, fromY] = cardSlots[0];
			const [toX, toY] = cardSlots[2];
			const arrow = S.bezier(
				[
					[fromX + 60, fromY - 250],
					[fromX + 300, fromY - 420],
					[toX - 200, toY - 420],
					[toX - 30, toY - 240],
				],
				30,
			);
			const draw = ramp(time, M.blocked + 0.2, 0.45, E.outQuad);
			const fade = 1 - ramp(time, M.stampThree + 0.6, 0.4);
			context.save();
			context.globalAlpha = fade;
			P.drawOn(context, arrow, draw, { width: 5, color: C.deep, seed: 61 });
			if (draw >= 1) {
				P.pencil(
					context,
					[
						[toX - 70, toY - 270],
						[toX - 30, toY - 240],
						[toX - 20, toY - 290],
					],
					{ width: 5, color: C.deep, seed: 62, gaps: false },
				);
			}
			context.restore();
		}
		for (const move of stampMoves) {
			const position = stampHandPosition(time, move.card, move.hit(), move.angle);
			if (!position) {
				continue;
			}
			const squash = Math.abs(time - move.hit()) < 0.06 ? 0.94 : 1;
			context.save();
			context.translate(position[0], position[1]);
			context.scale(1, squash);
			P.reachingArm(context, move.who, 0, 0, move.angle, { time, hold: holdStamp(time) });
			context.restore();
		}
		sparkleBurst(context, time, M.stampThree + 0.1, cardSlots[2][0], cardSlots[2][1], {
			count: 6,
			radius: 260,
			seed: 7,
		});
		context.restore();
	};

	/* ---------- scene 7: the recipient knows nothing ---------- */
	const secretSlots = [
		[1235, 320, -0.06],
		[1605, 330, 0.05],
		[1235, 770, 0.04],
		[1605, 760, -0.04],
	];
	const drawSecretScene = (context, time) => {
		skyBackground(context, time, { sun: false });
		const noteTimes = [M.noteOne, M.noteTwo, M.noteThree];
		cardItems.forEach((item, index) => {
			const [x, y, rotation] = secretSlots[index];
			const pop = popOptions(time, M.jana + 0.1 + index * 0.07, { rotation });
			if (!pop) {
				return;
			}
			drawCard(context, item, x, y, {
				scale: pop.scale * 0.6,
				rotation: pop.rotation,
				time,
				stamped: index < 3 ? 1 : null,
			});
			if (index < 3 && time >= noteTimes[index]) {
				const slap = popOptions(time, noteTimes[index], {
					rotation: -rotation * 2 + (index - 1) * 0.08,
				});
				P.draw(context, A.stickyNote('?', C.sunPale, `n${index}`), x, y - 10, {
					...slap,
					scale: slap.scale * 1.2,
				});
			}
		});
		const rise = settle(time, M.jana, 2, 6);
		const cover = ramp(time, M.coverEyes, 0.22, E.outBack);
		const peek = between(time, M.psst + 0.2, M.psst + 0.9)
			? Math.sin(((time - M.psst - 0.2) / 0.7) * Math.PI)
			: 0;
		const restLeft = [-176, -14];
		const restRight = [176, -14];
		const eyesLeft = [-66, -350 + peek * 46];
		const eyesRight = [66, -350];
		const pose = {
			expression: time < M.coverEyes ? 'oh' : 'grin',
			look: time < M.coverEyes ? 1 : 0,
			headTilt: time < M.coverEyes ? 0.08 : Math.sin(time * 4) * 0.04,
			bob: bounce(time) * 8,
			leftHand: [
				P.lerp(restLeft[0], eyesLeft[0], cover),
				P.lerp(restLeft[1], eyesLeft[1], cover),
			],
			rightHand: [
				P.lerp(restRight[0], eyesRight[0], cover),
				P.lerp(restRight[1], eyesRight[1], cover),
			],
			prop: (layerContext) => {
				if (cover < 0.6) {
					return;
				}
				const lean = Math.sin(pose.headTilt) * 20;
				for (const side of [-1, 1]) {
					const drop = side < 0 ? peek * 46 : 0;
					const palm = S.ellipse(side * 46 + lean, -380 + drop, 48, 40, 28, side * 0.35);
					A.part(layerContext, palm, C.skin, { seed: 870 + side, line: 3, shade: 0 });
				}
			},
		};
		P.puppet(context, 'jana', 560, 1200 - rise * 150, pose, {
			scale: 1.12,
			time,
			lift: 1 - rise,
		});
		if (time >= M.psst) {
			const pop = popOptions(time, M.psst, { rotation: 0.05 });
			P.draw(context, A.speechBubble('psst!', 300, 'psst'), 1420, 560, {
				...pop,
				scale: pop.scale * 0.85,
			});
		}
		for (let index = 0; index < 5; index++) {
			const start = M.coverEyes + 0.4 + index * 0.45;
			const local = time - start;
			if (local < 0 || local > 2.6) {
				continue;
			}
			const x =
				560 + (index % 2 ? 1 : -1) * (180 + index * 20) + Math.sin(local * 3 + index) * 20;
			const y = 520 - local * 170;
			P.draw(context, A.heart(index % 2 ? C.sakura : C.coral, 34), x, y, {
				scale: Math.min(1, local * 4) * (1 - P.clamp((local - 2) / 0.6)),
				rotation: Math.sin(local * 4) * 0.2,
				time,
				shadowAlpha: 0.2,
			});
		}
	};

	/* ---------- scene 8: the wish comes true ---------- */
	const drawPartyScene = (context, time) => {
		skyBackground(context, time, { sun: true, sunX: 1720, sunY: 230 });
		P.draw(context, A.bunting(1900), W / 2, 90, {
			shadowAlpha: 0.2,
			rotation: Math.sin(time * 1.2) * 0.005,
			time,
		});
		const balloonColors = [C.sky, C.mint, C.sakura, C.sun, C.bright];
		balloonColors.forEach((color, index) => {
			const start = M.party + 0.15 + index * 0.18;
			const local = time - start;
			if (local < 0) {
				return;
			}
			const x = [200, 420, 1500, 1720, 1300][index] + Math.sin(local * 1.6 + index) * 26;
			const y = 1350 - local * (300 + index * 30);
			P.draw(context, A.balloon(color), x, y, {
				scale: 0.75,
				rotation: Math.sin(local * 1.8 + index) * 0.08,
				time,
			});
		});
		const landed = time >= M.headphones;
		const pose = {
			expression: landed ? 'happyClosed' : 'grin',
			headTilt: Math.sin(time * 5) * 0.06,
			bob: bounce(time) * 16,
			leftHand: landed ? [-150, -330] : [-200, -300],
			rightHand: landed ? [150, -330] : [200, -300],
			headProp: landed
				? (headContext) =>
						P.draw(headContext, A.headphones(), 0, -38, {
							scale: 1.02,
							time,
							shadowAlpha: 0.2,
						})
				: null,
		};
		const puppetX = 780;
		const puppetY = 1110;
		const puppetScale = 1.1;
		P.puppet(context, 'jana', puppetX, puppetY, pose, { scale: puppetScale, time });
		const lid = ramp(time, M.party, 0.6, E.outCubic);
		A.drawGift(context, 1260, 900, {
			color: C.sky,
			ribbon: C.sun,
			key: 'dots',
			scale: 1.0,
			time,
			lidLift: lid * 900,
			lidRotation: lid * 2.2,
		});
		if (time >= M.party + 0.05 && !landed) {
			const flight = ramp(time, M.party + 0.05, M.headphones - M.party - 0.05, E.inOutQuad);
			const headY = puppetY + (-372 - 38 + bounce(time) * 16) * puppetScale;
			const [x, y] = arcPath([1260, 800], [puppetX, headY], 520, flight);
			P.draw(context, A.headphones(), x, y, {
				scale: 0.7 + flight * 0.42,
				rotation: (1 - flight) * 6.28,
				time,
				lift: 1,
			});
		}
		confetti(context, time, M.party, {
			originX: 1260,
			originY: 780,
			count: 110,
			seed: 5,
			power: 1.2,
		});
		confetti(context, time, M.party + 0.25, {
			originX: 160,
			originY: 1100,
			count: 50,
			seed: 8,
			spread: 0.5,
			power: 1.1,
		});
		confetti(context, time, M.party + 0.35, {
			originX: 1760,
			originY: 1100,
			count: 50,
			seed: 9,
			spread: 0.5,
			power: 1.1,
		});
	};

	/* ---------- scene 9: end card ---------- */
	const drawEndScene = (context, time) => {
		const sheetIn = ramp(time, M.endSheet, 0.4, E.outCubic);
		context.save();
		context.translate((1 - sheetIn) * (W + 200), (1 - sheetIn) * 120);
		context.rotate((1 - sheetIn) * 0.12);
		const sheet = P.sprite(
			'end-sheet',
			W + 220,
			H + 220,
			(sheetContext) => {
				const outline = P.torn(
					S.rect(-(W + 180) / 2, -(H + 180) / 2, W + 180, H + 180),
					901,
					{ spacing: 8, amplitude: 4 },
				);
				P.tracePath(sheetContext, outline);
				sheetContext.fillStyle = '#fcfeff';
				sheetContext.fill();
				sheetContext.globalAlpha = 0.4;
				sheetContext.fillStyle = P.paperFill(sheetContext, C.paper);
				sheetContext.fill();
			},
			{ border: 0, variants: 1 },
		);
		P.draw(context, sheet, W / 2, H / 2, { time, shadowAlpha: 0.35, lift: 1 - sheetIn });
		const corners = [
			[() => A.giftBody(C.sky, C.sun, 'dots'), 170, 170, -0.2, 0.55],
			[() => A.heart(C.sakura, 60), 1760, 150, 0.2, 0.9],
			[() => A.headphones(), 1720, 900, 0.18, 0.55],
			[() => A.teddy(), 190, 880, -0.12, 0.5],
			[() => A.balloon(C.mint), 1560, 190, 0.1, 0.45],
			[() => A.plant(), 400, 150, 0.08, 0.4],
		];
		corners.forEach(([make, x, y, rotation, scale], index) => {
			const floatY = Math.sin(time * 1.8 + index * 1.3) * 8;
			drawPop(context, make(), x, y + floatY, time, M.endLetters + 0.1 + index * 0.1, {
				scale,
				rotation: rotation + Math.sin(time * 1.2 + index) * 0.03,
			});
		});
		drawWordmark(context, time, M.endLogo, {
			x: W / 2,
			y: 470,
			withTld: true,
			scale: 0.92,
			lettersDelay: M.letters - M.logo,
			tldDelay: M.dotCz - M.endLogo,
		});
		P.handText(context, 'Sdílejte přání. Rezervace zůstanou tajemstvím.', W / 2, 720, {
			size: 82,
			align: 'center',
			reveal: ramp(time, M.tagline, 1.4, (x) => x),
			time,
			color: C.deep,
			weight: 700,
		});
		if (time >= M.button) {
			P.drawOn(
				context,
				S.bezier(
					[
						[560, 760],
						[860, 790],
						[1160, 770],
						[1370, 745],
					],
					30,
				),
				ramp(time, M.button, 0.35, E.outQuad),
				{ width: 7, color: C.sun, seed: 71, alpha: 1 },
			);
			sparkleBurst(context, time, M.button, W / 2, 470, {
				count: 12,
				radius: 820,
				seed: 11,
				colors: [C.sun, C.sky, C.sakura],
			});
		}
		context.restore();
	};

	/* ---------- main render ---------- */
	P.stage.film({
		prepare: (marks) => {
			M = marks;
			oldWorld = P.canvas(W, H);
			oldContext = oldWorld.getContext('2d');
		},
		draw: (context, time) => {
			if (time < M.scissors) {
				drawOldWorld(time);
				drawMutedImage(context);
			} else if (time < M.split + 0.55) {
				drawOldWorld(Math.min(time, M.scissors + 0.3));
				drawLogoScene(context, time);
				drawScissorsTransition(context, time);
			} else if (time < M.notebook) {
				drawLogoScene(context, time);
			} else if (time < M.fold) {
				drawLogoScene(context, time);
				if (time > M.notebook - 0.15) {
					drawWishlistScene(context, time);
				}
			} else if (time < M.cards) {
				drawShareScene(context, time);
			} else if (time < M.cards + 0.35) {
				drawShareScene(context, time);
				const wipe = ramp(time, M.cards - 0.05, 0.38, E.inOutCubic);
				context.save();
				context.translate(0, (1 - wipe) * H * 1.1);
				sheetShadow(context);
				drawReserveScene(context, time);
				context.restore();
			} else if (time < M.jana - 0.2) {
				drawReserveScene(context, time);
			} else if (time < M.jana + 0.1) {
				const wipe = ramp(time, M.jana - 0.2, 0.3, E.inOutCubic);
				context.save();
				context.translate(-wipe * W, 0);
				drawReserveScene(context, time);
				context.translate(W, 0);
				sheetShadow(context);
				drawSecretScene(context, time);
				context.restore();
			} else if (time < M.party - 0.12) {
				drawSecretScene(context, time);
			} else if (time < M.endSheet) {
				if (time < M.party + 0.05) {
					const wipe = ramp(time, M.party - 0.12, 0.17, E.inOutCubic);
					context.save();
					context.translate(0, -wipe * H);
					drawSecretScene(context, time);
					context.translate(0, H);
					sheetShadow(context);
					drawPartyScene(context, time);
					context.restore();
				} else {
					drawPartyScene(context, time);
				}
			} else {
				if (time < M.endSheet + 0.45) {
					drawPartyScene(context, time);
				}
				drawEndScene(context, time);
			}
		},
	});
})();
