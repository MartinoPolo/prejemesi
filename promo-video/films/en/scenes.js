/* The English film: twelve collage scenes driven by the named marks in cues.json. */
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

	/* ---------- shared helpers ---------- */
	const blinkAt = (time, offset = 0) =>
		Math.max(0, 1 - Math.abs(((time + offset) % 3.1) - 0.08) * 12);

	/* Eased motion through [time, x, y] keyframes. */
	const along = (time, frames) => {
		if (time <= frames[0][0]) {
			return frames[0].slice(1);
		}
		for (let index = 1; index < frames.length; index++) {
			const [end, x, y] = frames[index];
			if (time < end) {
				const [start, fromX, fromY] = frames[index - 1];
				const amount = E.inOutSine(P.progress(time, start, end - start));
				return [P.lerp(fromX, x, amount), P.lerp(fromY, y, amount)];
			}
		}
		return frames[frames.length - 1].slice(1);
	};

	/* Point on a sampled path, interpolated so slow flights stay smooth. */
	const pathPoint = (path, amount) => {
		const position = P.clamp(amount) * (path.length - 1);
		const index = Math.min(path.length - 2, Math.floor(position));
		const fraction = position - index;
		return [
			P.lerp(path[index][0], path[index + 1][0], fraction),
			P.lerp(path[index][1], path[index + 1][1], fraction),
		];
	};

	const shrinkAway = (time, start, duration = 0.25) => 1 - ramp(time, start, duration, E.inBack);

	const drawGridPaper = (context, tint = '#f4f8fb') => {
		context.fillStyle = P.paperFill(context, tint);
		context.fillRect(0, 0, W, H);
		context.save();
		context.globalAlpha = 0.5;
		context.strokeStyle = 'rgba(85,185,243,0.35)';
		context.lineWidth = 2;
		context.beginPath();
		for (let x = 0; x < W; x += 60) {
			context.moveTo(x, 0);
			context.lineTo(x, H);
		}
		for (let y = 0; y < H; y += 60) {
			context.moveTo(0, y);
			context.lineTo(W, y);
		}
		context.stroke();
		context.restore();
	};

	/* The next sheet slides over the previous scene from `direction`; the old one drifts slightly. */
	const slideOver = (
		context,
		time,
		start,
		drawFrom,
		drawTo,
		[directionX, directionY],
		duration = 0.42,
	) => {
		const amount = ramp(time, start, duration, E.inOutCubic);
		context.save();
		context.translate(-directionX * amount * 180, -directionY * amount * 120);
		drawFrom(context, time);
		context.restore();
		context.save();
		context.translate(
			directionX * (1 - amount) * W * 1.04,
			directionY * (1 - amount) * H * 1.06,
		);
		context.rotate((1 - amount) * 0.03 * (directionX || directionY));
		sheetShadow(context);
		drawTo(context, time);
		context.restore();
	};

	/* An open hand that reaches in, taps a target (fixed, or moving with time) and leaves. */
	const tapArm = (context, time, name, target, tapTimes, angle, reach = 760) => {
		const [targetX, targetY] = typeof target === 'function' ? target(time) : target;
		const taps = [tapTimes].flat();
		const approach = ramp(time, taps[0] - 0.45, 0.38, E.outCubic);
		const leave = ramp(time, taps[taps.length - 1] + 0.16, 0.42, E.inCubic);
		if (approach <= 0 || leave >= 1) {
			return;
		}
		const amount = approach * (1 - leave);
		const awayX = targetX + Math.sin(angle) * reach;
		const awayY = targetY - Math.cos(angle) * reach;
		const press = taps.some((tap) => between(time, tap - 0.07, tap + 0.09)) ? 1 : -0.6;
		P.reachingArm(
			context,
			name,
			P.lerp(awayX, targetX, amount) - Math.sin(angle) * press * 16,
			P.lerp(awayY, targetY, amount) + Math.cos(angle) * press * 16,
			angle,
			{ time, grip: false },
		);
	};

	const holdStamp =
		(time, scale = 0.8) =>
		(context) =>
			P.draw(context, A.stampTool(), 0, 88 * (scale / 0.8), {
				scale,
				time,
				shadowAlpha: 0.2,
			});

	/* A stamp hand: hover above the target, press at `hit`, then leave off-screen. It arrives from
	   off-screen too, unless `from` continues a gesture already on screen. */
	const stampApproach = (time, hit) => ramp(time, hit - 0.42, 0.3, E.outCubic);
	const stampHandPosition = (time, [targetX, targetY], hit, angle, from) => {
		const hover = [targetX + 20, targetY - 330];
		const impact = [targetX, targetY - 150];
		const offscreen = [targetX + Math.sin(angle) * -900, -700];
		const [startX, startY] = from ?? offscreen;
		if (time < hit - 0.42) {
			return null;
		}
		if (time < hit - 0.12) {
			const amount = stampApproach(time, hit);
			return [P.lerp(startX, hover[0], amount), P.lerp(startY, hover[1], amount)];
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

	const drawStampArm = (
		context,
		time,
		who,
		target,
		hit,
		angle,
		{ scale = 0.8, from, fromAngle = angle } = {},
	) => {
		const position = stampHandPosition(time, target, hit, angle, from);
		if (!position) {
			return;
		}
		context.save();
		context.translate(position[0], position[1]);
		context.scale(1, Math.abs(time - hit) < 0.06 ? 0.94 : 1);
		P.reachingArm(context, who, 0, 0, P.lerp(fromAngle, angle, stampApproach(time, hit)), {
			time,
			hold: holdStamp(time, scale),
		});
		context.restore();
	};

	const drawStampMark = (context, since, x, y, scale, rotation = -0.2, time = 0) => {
		if (since === null || since < 0) {
			return;
		}
		const impact = P.clamp(since / 0.08);
		P.draw(context, A.stampMark('RESERVED'), x, y, {
			scale: (1.25 - impact * 0.25) * scale,
			rotation,
			alpha: impact * 0.92,
			time,
			shadowAlpha: 0,
		});
	};

	/* ---------- wish cards ---------- */
	const cardItems = [
		{
			key: 'headphones',
			make: () => A.headphones(),
			label: 'Headphones',
			price: '€79',
			scale: 0.62,
		},
		{ key: 'book', make: () => A.book('Stars'), label: 'Book', price: '€15', scale: 0.62 },
		{ key: 'plant', make: () => A.plant(), label: 'Monstera', price: '€25', scale: 0.6 },
		{ key: 'teapot', make: () => A.teapot(), label: 'Teapot', price: '€30', scale: 0.58 },
	];

	const cardBack = () =>
		P.sprite('card-back', 330, 400, (context) => {
			const outline = A.part(context, S.roundRect(-150, -185, 300, 370, 22), C.sakuraPale, {
				seed: 331,
				shade: 0,
			});
			P.stripes(context, outline, {
				color: C.white,
				width: 16,
				spacing: 46,
				angle: 0.6,
				alpha: 0.55,
				seed: 332,
			});
			A.part(context, S.rect(-20, -185, 40, 370), C.sky, { seed: 333, line: 2 });
			A.part(context, S.rect(-150, -20, 300, 40), C.sky, { seed: 334, line: 2 });
			for (const side of [-1, 1]) {
				A.part(context, S.ellipse(side * 40, -34, 42, 24, 24, side * 0.5), C.sky, {
					seed: 335 + side,
					line: 2.4,
				});
			}
			A.part(context, S.ellipse(0, -28, 16, 16, 16), C.deep, { seed: 338, line: 2 });
		});

	/*
	 * A wish card. `stamped` is seconds since the RESERVED stamp hit, `flip` turns it over to its
	 * gift-wrapped back, `checked` is seconds since it was marked received.
	 */
	const drawCard = (
		context,
		item,
		x,
		y,
		{
			scale = 1,
			rotation = 0,
			time,
			lift = 0,
			stamped = null,
			alpha = 1,
			flip = 0,
			checked = null,
		},
	) => {
		context.save();
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(scale * Math.max(0.03, Math.abs(Math.cos(flip * Math.PI))), scale);
		if (flip > 0.5) {
			P.draw(context, cardBack(), 0, 0, { time, lift, alpha });
		} else {
			P.draw(context, A.card(item.key, item.label, item.price), 0, 0, { time, lift, alpha });
			P.draw(context, item.make(), 0, -60, {
				scale: item.scale,
				time,
				shadowAlpha: 0.2,
				alpha,
			});
			drawStampMark(context, stamped, 0, 20, 0.66, -0.2, time);
			if (checked !== null && checked >= 0) {
				const pop = popOptions(time, time - checked, { rotation: 0.12 });
				P.draw(context, A.checkBadge(), 118, -168, { ...pop, scale: pop.scale * 0.95 });
			}
		}
		context.restore();
	};

	/* ---------- scene 1: the birthday question ---------- */
	const family = [
		{
			name: 'grandma',
			x: 270,
			rise: 'grandmaRise',
			ask: 'askGrandma',
			label: '?',
			width: 190,
			size: 104,
			bubble: [380, 300],
			tail: -1,
			look: 1,
		},
		{
			name: 'aunt',
			x: 1480,
			rise: 'auntRise',
			ask: 'askAunt',
			label: 'what would you like?',
			width: 620,
			size: 56,
			bubble: [1250, 200],
			tail: 1,
			look: -1,
		},
		{
			name: 'friend',
			x: 1760,
			rise: 'friendRise',
			ask: 'askFriend',
			label: 'so…?',
			width: 280,
			size: 76,
			bubble: [1700, 340],
			tail: -1,
			look: -1,
		},
	];
	const questionBubbles = [
		[500, 390, C.skyPale, -0.12],
		[1010, 420, C.sunPale, 0.1],
		[600, 170, C.mintPale, 0.06],
		[900, 140, C.sakuraPale, -0.08],
		[420, 590, C.sunPale, 0.14],
		[1090, 610, C.skyPale, -0.1],
	];
	const giftSpot = [1030, 770];

	const drawRoomScene = (context, time) => {
		P.draw(context, wallSprite(), W / 2, H / 2, { shadowAlpha: 0, time });
		P.draw(context, frameSprite(), 1560, 250, { rotation: 0.03, time, scale: 0.85 });
		P.draw(context, A.bunting(1800), W / 2, 80 + settle(time, 0.05, 1.6, 4) * 170 - 170, {
			shadowAlpha: 0.2,
			rotation: Math.sin(time * 1.3) * 0.006,
			time,
		});
		drawPop(context, A.banner('Happy birthday!'), 780, 250, time, M.banner, {
			scale: 0.85,
			rotation: -0.03,
		});

		family.forEach((member, index) => {
			const rise = settle(time, M[member.rise], 2, 6.5);
			if (rise <= 0) {
				return;
			}
			const asked = time - M[member.ask];
			const excited = asked > 0 && asked < 0.8;
			const pose = {
				expression: excited ? 'oh' : 'smile',
				look: member.look,
				headTilt:
					Math.sin(time * 2 + index) * 0.04 + (excited ? Math.sin(asked * 14) * 0.05 : 0),
				bob: Math.sin(time * 3 + index * 1.7) * 4,
				blink: blinkAt(time, index * 0.9),
				leftHand: excited && index === 0 ? [-60, -330] : [-176, -14],
				rightHand: excited && index > 0 ? [120, -330] : [176, -14],
			};
			P.puppet(context, member.name, member.x, 1420 - rise * 420, pose, {
				scale: 0.8,
				time,
			});
		});

		/* Jana behind the table: pleased, then puzzled, then shrugging */
		const shrugging = between(time, M.questions, M.giftDrop);
		const janaIn = settle(time, 0.2, 1.8, 6);
		const lookDirection = between(time, M.askGrandma, M.askFriend)
			? -1
			: between(time, M.askFriend, M.questions) || time >= M.giftDrop
				? 1
				: 0;
		const expression =
			time < M.cake
				? 'smile'
				: time < M.askGrandma
					? 'grin'
					: shrugging
						? 'worried'
						: time < M.giftDrop
							? 'smile'
							: time < M.giftLand + 0.3
								? 'oh'
								: 'grin';
		const shrug = ramp(time, M.questions + 0.2, 0.3, E.outBack) * shrinkAway(time, M.giftDrop);
		P.puppet(
			context,
			'jana',
			740,
			1300 - janaIn * 270,
			{
				expression,
				look: lookDirection,
				headTilt: shrugging
					? Math.sin(time * 3) * 0.08
					: Math.sin(time * 2.2) * 0.04 + (time > M.giftLand ? -0.06 : 0),
				bob: Math.sin(time * 3.1) * 4 - shrug * 10,
				blink: blinkAt(time, 0.4),
				leftHand: [P.lerp(-176, -250, shrug), P.lerp(-14, -250, shrug)],
				rightHand: [P.lerp(176, 250, shrug), P.lerp(-14, -250, shrug)],
				leftGrip: shrug > 0.5 ? false : undefined,
				rightGrip: shrug > 0.5 ? false : undefined,
			},
			{ scale: 1.05, time },
		);

		P.draw(context, tableSprite(), W / 2, 990, { shadowAlpha: 0.25, time });
		const cake = popOptions(time, M.cake, { rotation: 0.02 });
		if (cake) {
			P.draw(context, A.cake(), 1270, 740, { ...cake, scale: cake.scale * 0.72 });
			sparkleBurst(context, time, M.cake + 0.1, 1270, 580, {
				count: 5,
				radius: 220,
				seed: 31,
			});
		}

		/* the questions pile up */
		family.forEach((member) => {
			const pop = popOptions(time, M[member.ask], { rotation: member.tail * -0.04 });
			if (!pop) {
				return;
			}
			const away = shrinkAway(time, M.giftDrop + 0.05);
			P.draw(
				context,
				A.speechBubble(member.label, member.width, member.name, {
					size: member.size,
					tail: member.tail,
				}),
				member.bubble[0],
				member.bubble[1] + Math.sin(time * 2 + member.x) * 5,
				{ ...pop, scale: pop.scale * 0.9 * away },
			);
		});
		questionBubbles.forEach(([x, y, color, rotation], index) => {
			const pop = popOptions(time, M.questions + index * 0.2, { rotation });
			if (!pop) {
				return;
			}
			const away = shrinkAway(time, M.giftDrop + index * 0.04);
			P.draw(
				context,
				A.speechBubble('?', 170, `question-${index}`, {
					color,
					size: 96,
					tail: index % 2 ? 1 : -1,
				}),
				x + Math.sin(time * 2.6 + index) * 8,
				y + Math.cos(time * 2.2 + index) * 8,
				{ ...pop, scale: pop.scale * 0.78 * away },
			);
		});

		/* the answer drops onto the table */
		if (time >= M.giftDrop) {
			const fall = ramp(time, M.giftDrop, M.giftLand - M.giftDrop, E.inQuad);
			const squash = time > M.giftLand ? settle(time, M.giftLand, 3.5, 7) : 1;
			const wiggle = ramp(time, M.lidPop - 0.6, 0.6, E.inQuad) * Math.sin(time * 42) * 0.035;
			const lid = ramp(time, M.lidPop, 0.4, E.outCubic);
			context.save();
			context.translate(giftSpot[0], giftSpot[1] + 85);
			context.scale(1 + (1 - squash) * 0.12, 0.82 + squash * 0.18);
			context.translate(-giftSpot[0], -giftSpot[1] - 85);
			A.drawGift(context, giftSpot[0], P.lerp(-260, giftSpot[1], fall), {
				color: C.sky,
				ribbon: C.sun,
				key: 'dots',
				scale: 1.05,
				rotation: wiggle,
				time,
				lift: 1 - fall,
				lidLift: lid * 1400,
				lidRotation: -lid * 1.6,
			});
			context.restore();
			sparkleBurst(context, time, M.lidPop - 0.7, giftSpot[0], giftSpot[1] - 120, {
				count: 6,
				radius: 260,
				seed: 33,
			});
		}
	};

	/* the logo bursts out of the box through a torn paper hole */
	const drawIris = (context, time) => {
		const open = ramp(time, M.lidPop + 0.05, 0.6, E.inCubic);
		if (open <= 0) {
			return;
		}
		const radius = 30 + open * 2300;
		const outline = P.torn(S.ellipse(giftSpot[0], giftSpot[1] - 110, radius, radius, 90), 77, {
			spacing: 18,
			amplitude: 7,
		});
		context.save();
		context.shadowColor = 'rgba(22,40,70,0.35)';
		context.shadowBlur = 30;
		P.tracePath(context, outline);
		context.fillStyle = C.paper;
		context.fill();
		context.restore();
		context.save();
		P.tracePath(context, outline);
		context.clip();
		drawLogoScene(context, time);
		context.restore();
		context.save();
		context.strokeStyle = P.paperFill(context, C.paper);
		context.lineWidth = 12;
		P.tracePath(context, outline);
		context.stroke();
		context.restore();
	};

	/* ---------- scene 2: the logo ---------- */
	const logoY = 440;
	const drawLogoScene = (context, time) => {
		skyBackground(context, time);
		drawWordmark(context, time, M.logo, {
			x: W / 2,
			y: logoY,
			lettersDelay: M.letters - M.logo,
		});
		sparkleBurst(context, time, M.letters, W / 2, logoY, { count: 10, radius: 700, seed: 3 });
		if (time < M.czechFor) {
			return;
		}
		P.handText(context, 'Czech for “we wish”', 1060, 810, {
			size: 112,
			align: 'center',
			reveal: ramp(time, M.czechFor, 0.85, E.linear),
			time,
			rotation: -0.03,
			color: C.deep,
		});
		const arrow = S.bezier(
			[
				[690, 790],
				[570, 800],
				[510, 710],
				[580, 670],
				[640, 635],
				[690, 700],
				[630, 720],
				[560, 740],
				[550, 650],
				[630, 600],
			],
			14,
		);
		P.drawOn(context, arrow, ramp(time, M.czechFor + 0.8, 0.45, E.outQuad), {
			width: 6,
			color: C.deep,
			seed: 91,
		});
		if (time > M.czechFor + 1.25) {
			P.pencil(
				context,
				[
					[596, 602],
					[630, 600],
					[613, 630],
				],
				{ width: 6, color: C.deep, seed: 92, gaps: false },
			);
		}
		sparkleBurst(context, time, M.czechFor + 1.1, 1060, 780, {
			count: 6,
			radius: 560,
			seed: 21,
			colors: [C.sun, C.sakura, C.bright],
		});
	};

	/* ---------- scene 3: a list for any occasion, styled your way ---------- */
	const listCardCenter = [600, 560];
	const listPalettes = [
		{ name: 'Sky', color: C.sky },
		{ name: 'Mint', color: C.mint },
		{ name: 'Peach', color: C.coral },
		{ name: 'Grape', color: C.grape },
		{ name: 'Sakura', color: C.sakura },
		{ name: 'Ocean', color: '#0fa8a8' },
		{ name: 'Honey', color: '#efa00b' },
		{ name: 'Ruby', color: C.ruby },
		{ name: 'Matcha', color: '#7fb023' },
		{ name: 'Graphite', color: '#526a85' },
	];
	const paletteIndex = (name) => listPalettes.findIndex((palette) => palette.name === name);
	/* No strips far left in the fan: the arm reaches in from the right and is too short to get there
	   while its sleeve still leaves the frame. */
	const paletteTaps = [
		['paletteOne', 'Honey'],
		['paletteTwo', 'Matcha'],
		['paletteThree', 'Grape'],
		['paletteFour', 'Ocean'],
		['paletteFive', 'Sakura'],
	];
	const tappedPalettes = (time) => paletteTaps.filter(([mark]) => time >= M[mark]);

	/* Like the app, the page tint and pale accents are the palette colour mixed into white. */
	const mixWithWhite = (hex, amount) =>
		`#${[1, 3, 5]
			.map((start) =>
				Math.round(255 + (parseInt(hex.slice(start, start + 2), 16) - 255) * amount)
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')}`;
	const wobble = (time, start, amount) =>
		time >= start ? (1 - settle(time, start, 3, 8)) * amount : 0;

	const listCard = (color) =>
		P.sprite(`list-card-${color}`, 780, 640, (context) => {
			A.part(context, S.roundRect(-370, -300, 740, 600, 36), mixWithWhite(color, 0.11), {
				seed: 1811,
				shade: 0,
			});
			const pale = mixWithWhite(color, 0.2);
			[0, 1, 2].forEach((index) => {
				const y = 20 + index * 88;
				A.part(context, S.roundRect(-332, y - 8, 664, 80, 18), C.white, {
					seed: 1824 + index,
					line: 0,
					shade: 0,
				});
				A.part(context, S.roundRect(-310, y, 64, 64, 14), pale, {
					seed: 1812 + index,
					line: 2,
					shade: 0,
				});
				A.line(
					context,
					[
						[-220, y + 22],
						[index === 1 ? 120 : 230, y + 22],
					],
					{ seed: 1815 + index, width: 9, color: C.creamDark, alpha: 1 },
				);
				A.line(
					context,
					[
						[-220, y + 48],
						[-40, y + 48],
					],
					{ seed: 1818 + index, width: 6, color: pale, alpha: 1 },
				);
			});
		});
	const listBand = (color) =>
		P.sprite(
			`list-band-${color}`,
			780,
			640,
			(context) => {
				context.save();
				P.tracePath(context, S.roundRect(-362, -292, 724, 584, 30));
				context.clip();
				P.piece(context, S.rect(-380, -310, 760, 250), color, { seed: 1821, shade: 0.6 });
				context.restore();
				A.line(
					context,
					[
						[-362, -60],
						[362, -60],
					],
					{ seed: 1822, width: 2.5, alpha: 0.5 },
				);
			},
			{ border: 0, variants: 2 },
		);

	/* The list wears the last tapped palette; each new tap wipes across it. */
	const drawListPaper = (context, time, grow) => {
		const tapped = tappedPalettes(time);
		const colors = [C.sky, ...tapped.map(([, name]) => listPalettes[paletteIndex(name)].color)];
		const current = colors[colors.length - 1];
		const lastTap = tapped.at(-1);
		const wipe = lastTap ? ramp(time, M[lastTap[0]], 0.3, E.inOutQuad) : 1;
		const drawPaper = (color, shadowAlpha = 0.34) => {
			P.draw(context, listCard(color), 0, 0, { time, lift: 1 - grow, shadowAlpha });
			P.draw(context, listBand(color), 0, 0, { time, shadowAlpha: 0 });
		};
		if (wipe >= 1) {
			drawPaper(current);
			return;
		}
		drawPaper(colors[colors.length - 2]);
		const edge = -420 + wipe * 880;
		context.save();
		P.tracePath(context, [
			[-420, -340],
			[edge + 50, -340],
			[edge - 50, 340],
			[-420, 340],
		]);
		context.clip();
		drawPaper(current, 0);
		context.restore();
	};

	const occasionTile = (label) =>
		P.sprite(`occasion-${label}`, 300, 340, (context) => {
			A.part(context, S.roundRect(-140, -160, 280, 320, 26), C.white, {
				seed: 1801 + label.length,
				shade: 0,
			});
			A.text(context, label, 0, 116, { size: 50, font: P.font.hand, color: C.ink });
		});
	const occasions = [
		{
			make: () => A.cake(),
			label: 'Birthday',
			mark: 'birthday',
			slot: [1300, 300, -0.05],
			scale: 0.5,
		},
		{
			make: () => A.christmasTree(),
			label: 'Christmas',
			mark: 'christmas',
			slot: [1640, 290, 0.05],
			scale: 0.48,
		},
		{
			make: () => A.weddingRings(),
			label: 'Wedding',
			mark: 'wedding',
			slot: [1300, 740, 0.04],
			scale: 0.56,
		},
		{
			make: () => A.daisy(),
			label: 'Just because',
			mark: 'justBecause',
			slot: [1640, 750, -0.04],
			scale: 0.46,
		},
	];

	/* A swatch fan deck of the palettes, riveted at the bottom. Long strips keep each swatch wide
	   where the fan spreads; the first strip lies on top, so every other strip shows its right side. */
	const fanPivot = [1455, 1040];
	const fanScale = 1.2;
	const fanRivetY = 180;
	const fanSwatchSpot = [24, -178];
	const fanAngle = (index) => (index - (listPalettes.length - 1) / 2) * 0.19;
	const paletteStrip = ({ name, color }) =>
		P.sprite(`palette-strip-${name}`, 124, 560, (context) => {
			A.part(context, S.roundRect(-55, -270, 110, 470, 12), C.white, {
				seed: 1861,
				shade: 0,
			});
			A.part(context, S.roundRect(-45, -258, 90, 160, 8), color, { seed: 1862, line: 2 });
			[0.5, 0.2].forEach((amount, index) =>
				A.part(
					context,
					S.roundRect(-45 + index * 48, -86, 42, 42, 6),
					mixWithWhite(color, amount),
					{ seed: 1863 + index, line: 1.6, shade: 0 },
				),
			);
			A.text(context, name, 0, -6, { size: 30, font: P.font.hand, color: C.ink });
			P.tracePath(context, S.ellipse(0, fanRivetY, 9, 9, 12));
			context.fillStyle = C.creamDark;
			context.fill();
		});
	const fanRivet = () =>
		P.sprite(
			'fan-rivet',
			36,
			36,
			(context) => {
				A.part(context, S.ellipse(0, 0, 13, 13, 16), C.kraft, { seed: 1869, line: 2.2 });
			},
			{ border: 0 },
		);
	const fanPivotAt = (time) => [
		fanPivot[0],
		fanPivot[1] +
			(1 - settle(time, M.fanUp, 2.2, 7)) * 640 +
			ramp(time, M.fanAway + 0.2, 0.4, E.inBack) * 720,
	];
	const fanSpread = (time, index) =>
		settle(time, M.fanOpen + index * 0.035, 2.4, 6.5) *
		(1 - ramp(time, M.fanAway, 0.3, E.inQuad));
	const paletteLift = (time, index) => {
		const tap = paletteTaps.findIndex(([, name]) => paletteIndex(name) === index);
		if (tap < 0) {
			return 0;
		}
		const next = paletteTaps[tap + 1];
		const drop = next ? ramp(time, M[next[0]] - 0.12, 0.2) : ramp(time, M.fanAway, 0.25);
		return ramp(time, M[paletteTaps[tap][0]] - 0.1, 0.22, E.outBack) * (1 - drop);
	};
	const drawPaletteFan = (context, time) => {
		if (!between(time, M.fanUp, M.fanAway + 0.65)) {
			return;
		}
		const [pivotX, pivotY] = fanPivotAt(time);
		const order = [...listPalettes.keys()]
			.reverse()
			.sort((first, second) => paletteLift(time, first) - paletteLift(time, second));
		for (const index of order) {
			const angle = fanAngle(index) * fanSpread(time, index);
			const lift = paletteLift(time, index);
			const sprite = paletteStrip(listPalettes[index]);
			P.draw(
				context,
				sprite,
				pivotX + Math.sin(angle) * lift * 70,
				pivotY - Math.cos(angle) * lift * 70,
				{
					scale: fanScale,
					rotation: angle,
					anchorY: 0.5 + fanRivetY / sprite.height,
					lift: lift * 0.6,
					time,
				},
			);
		}
		P.draw(context, fanRivet(), pivotX, pivotY, { time, shadowAlpha: 0.2 });
	};
	const paletteTapTarget = (time) =>
		along(
			time,
			paletteTaps.flatMap(([mark, name]) => {
				const angle = fanAngle(paletteIndex(name));
				const [spotX, spotY] = [fanSwatchSpot[0], fanSwatchSpot[1] - fanRivetY];
				const x =
					fanPivot[0] + (spotX * Math.cos(angle) - spotY * Math.sin(angle)) * fanScale;
				const y =
					fanPivot[1] + (spotX * Math.sin(angle) + spotY * Math.cos(angle)) * fanScale;
				return [
					[M[mark] - 0.14, x, y],
					[M[mark] + 0.1, x, y],
				];
			}),
		);

	/* The cover photo is painted once; the dropped print and every slot show crops of it. */
	const coverFrame = [-280, -210, 560, 420];
	const coverCrops = {
		full: coverFrame,
		card: [-175, -150, 420, 280],
		thumbnail: [-35, -115, 230, 230],
		sharing: [-250, -131, 500, 262],
	};
	const coverPicture = () =>
		P.sprite(
			'cover-picture',
			coverFrame[2],
			coverFrame[3],
			(context) => {
				P.tracePath(context, S.rect(...coverFrame));
				context.clip();
				const sky = context.createLinearGradient(0, -210, 0, 210);
				sky.addColorStop(0, '#bfe4fb');
				sky.addColorStop(1, '#eef8fe');
				context.fillStyle = sky;
				context.fillRect(...coverFrame);
				P.draw(context, A.sun(), 215, -135, { scale: 0.42, shadowAlpha: 0 });
				P.draw(context, A.cloud(220, 'cover'), -40, -170, { scale: 0.62, shadowAlpha: 0 });
				for (const [color, x, y, rotation] of [
					[C.sakura, -165, -70, -0.1],
					[C.sun, -105, -105, 0.05],
					[C.bright, -45, -50, 0.12],
				]) {
					P.draw(context, A.balloon(color), x, y, {
						scale: 0.42,
						rotation,
						shadowAlpha: 0.15,
					});
				}
				P.draw(context, A.hills(C.mintPale, 'cover-far', 26, 700, 220), 20, 170, {
					shadowAlpha: 0,
				});
				P.draw(context, A.hills(C.leaf, 'cover-near', 20, 700, 160), -40, 230, {
					shadowAlpha: 0,
				});
				P.puppet(context, 'jana', 80, 260, { expression: 'grin' }, { scale: 0.7 });
			},
			{ border: 0, variants: 1 },
		);
	const coverPrint = (crop, width) => {
		const [cropX, cropY, cropWidth, cropHeight] = coverCrops[crop];
		const height = (width * cropHeight) / cropWidth;
		const margin = Math.max(8, width * 0.035);
		return P.sprite(
			`cover-print-${crop}-${width}`,
			width + margin * 2,
			height + margin * 2,
			(context) => {
				A.part(
					context,
					S.rect(
						-width / 2 - margin,
						-height / 2 - margin,
						width + margin * 2,
						height + margin * 2,
					),
					C.white,
					{ seed: 1881, line: 2, shade: 0 },
				);
				const picture = coverPicture().frames[0];
				const pad = (picture.width - coverFrame[2]) / 2;
				context.drawImage(
					picture,
					pad + cropX - coverFrame[0],
					pad + cropY - coverFrame[1],
					cropWidth,
					cropHeight,
					-width / 2,
					-height / 2,
					width,
					height,
				);
			},
		);
	};
	const coverPrintPlace = [1480, 430];
	const coverPrintScale = 0.8;
	const coverSlotY = 845;
	const coverSlots = [
		{ mark: 'slotCard', crop: 'card', label: 'Card', width: 190, x: 1265 },
		{ mark: 'slotThumb', crop: 'thumbnail', label: 'Thumbnail', width: 130, x: 1480 },
		{ mark: 'slotShare', crop: 'sharing', label: 'Sharing', width: 220, x: 1705 },
	];
	const coverOnCard = { x: 376, y: -266, rotation: 0.08, scale: 1.12 };
	const coverLanding = () => M.coverOn + 0.4;
	const coverTape = (key) => A.tape(120, 'rgba(255,233,168,0.85)', key);

	const drawCropBrackets = (context, [x, y, width, height], alpha) => {
		const arm = 54;
		for (const [cornerX, cornerY, directionX, directionY] of [
			[x, y, 1, 1],
			[x + width, y, -1, 1],
			[x + width, y + height, -1, -1],
			[x, y + height, 1, -1],
		]) {
			P.pencil(
				context,
				[
					[cornerX + directionX * arm, cornerY],
					[cornerX, cornerY],
					[cornerX, cornerY + directionY * arm],
				],
				{
					width: 10,
					color: C.ink,
					alpha,
					seed: 61 + directionX * 3 + directionY,
					gaps: false,
				},
			);
		}
	};

	/* A photo lands, gets cropped just right, and each slot previews its own crop. */
	const drawCoverDesk = (context, time, cardToWorld) => {
		if (!between(time, M.coverPhoto, M.coverOn + 1.2)) {
			return;
		}
		const exit = (order) => ramp(time, M.coverOn + 0.5 + order * 0.06, 0.4, E.inBack) * 900;
		const drop = ramp(time, M.coverPhoto, 0.35, E.outBack);
		const rotation = P.lerp(0.2, -0.03, drop);
		context.save();
		context.translate(coverPrintPlace[0] + exit(0), P.lerp(-320, coverPrintPlace[1], drop));
		context.rotate(rotation);
		context.scale(coverPrintScale, coverPrintScale);
		P.draw(context, coverPrint('full', coverFrame[2]), 0, 0, { lift: 1 - drop, time });
		const frameIn = ramp(time, M.cropFrame, 0.3, E.outQuad);
		if (frameIn > 0) {
			const tighten = ramp(time, M.cropFrame + 0.75, 0.7, E.inOutCubic);
			const crop = coverCrops.card.map((value, index) =>
				P.lerp(coverFrame[index], value, tighten),
			);
			context.save();
			context.globalAlpha = frameIn * 0.42;
			context.beginPath();
			context.rect(...coverFrame);
			context.rect(...crop);
			context.fillStyle = C.ink;
			context.fill('evenodd');
			context.restore();
			const pulse = wobble(time, M.cropSnap, 0.08);
			drawCropBrackets(
				context,
				[
					crop[0] - (crop[2] * pulse) / 2,
					crop[1] - (crop[3] * pulse) / 2,
					crop[2] * (1 + pulse),
					crop[3] * (1 + pulse),
				],
				frameIn,
			);
		}
		[-1, 1].forEach((side) =>
			P.draw(context, coverTape(`cover-${side}`), side * 250, -222, {
				rotation: side * 0.5,
				scale: settle(time, M.coverPhoto + 0.35 + (side + 1) * 0.04, 3, 8),
				time,
				shadowAlpha: 0.1,
			}),
		);
		context.restore();

		coverSlots.forEach((slot, index) => {
			const pop = popOptions(time, M[slot.mark], { rotation: (index - 1) * 0.05 });
			if (!pop) {
				return;
			}
			const flies = slot.crop === 'card' && time >= M.coverOn;
			const x = slot.x + (flies ? 0 : exit(index + 1));
			P.handText(context, slot.label, x, coverSlotY + 120, {
				size: 42,
				align: 'center',
				color: C.inkSoft,
				reveal: ramp(time, M[slot.mark] + 0.1, 0.35, E.outQuad),
				alpha: flies ? 1 - ramp(time, M.coverOn, 0.2) : 1,
				time,
			});
			const sprite = coverPrint(slot.crop, slot.width);
			if (!flies) {
				P.draw(context, sprite, x, coverSlotY, pop);
				return;
			}
			if (time >= coverLanding()) {
				return;
			}
			const flight = ramp(time, M.coverOn, 0.4, E.inOutQuad);
			const [flightX, flightY] = arcPath(
				[slot.x, coverSlotY],
				cardToWorld([coverOnCard.x, coverOnCard.y]),
				220,
				flight,
			);
			P.draw(context, sprite, flightX, flightY, {
				scale: P.lerp(1, coverOnCard.scale, flight),
				rotation: P.lerp(pop.rotation, coverOnCard.rotation - 0.02, flight),
				lift: 1,
				time,
			});
		});
	};

	/* Category tabs slide out from under the list, and each row takes its category's colour. */
	const categories = [
		{ mark: 'tabOne', label: 'Books', color: C.sky },
		{ mark: 'tabTwo', label: 'Garden', color: C.mint },
		{ mark: 'tabThree', label: 'Sweets', color: C.coral },
	];
	const categoryTab = ({ label, color }) =>
		P.sprite(`category-tab-${label}`, 260, 84, (context) => {
			A.part(context, S.roundRect(-120, -38, 240, 76, 24), color, {
				seed: 1871 + label.length,
			});
			A.text(context, label, 30, 2, { size: 50, font: P.font.hand, color: C.white });
		});
	const categorySwatch = (color) =>
		P.sprite(
			`category-swatch-${color}`,
			64,
			64,
			(context) => {
				A.part(context, S.roundRect(-32, -32, 64, 64, 14), mixWithWhite(color, 0.55), {
					seed: 1875,
					line: 2,
					shade: 0,
				});
			},
			{ border: 0 },
		);
	const drawCategoryTabs = (context, time) =>
		categories.forEach((category, index) => {
			if (time >= M[category.mark]) {
				const slide = settle(time, M[category.mark], 2.4, 6.5);
				P.draw(context, categoryTab(category), 242 + slide * 180, 52 + index * 88, {
					rotation: (1 - slide) * 0.1,
					time,
				});
			}
		});
	const drawCategorySwatches = (context, time) =>
		categories.forEach((category, index) =>
			drawPop(
				context,
				categorySwatch(category.color),
				-278,
				52 + index * 88,
				time,
				M[category.mark] + 0.1,
				{
					shadowAlpha: 0.15,
				},
			),
		);

	const drawListScene = (context, time) => {
		drawGridPaper(context);
		const [cardX, cardY] = listCardCenter;
		const cardToWorld = ([x, y]) => [
			cardX + x * Math.cos(-0.02) - y * Math.sin(-0.02),
			cardY + x * Math.sin(-0.02) + y * Math.cos(-0.02),
		];
		const styleSlide = 360;
		const styleHeart = [-372, 300];

		/* "+ New list" becomes the list itself */
		const chipPop = popOptions(time, M.newList);
		const chipAway = shrinkAway(time, M.tapNewList + 0.12, 0.2);
		if (chipPop && chipAway > 0) {
			const press = between(time, M.tapNewList - 0.07, M.tapNewList + 0.1) ? 0.92 : 1;
			P.draw(
				context,
				A.chip('+ New list', {
					color: C.sky,
					textColor: C.white,
					width: 420,
					height: 116,
					size: 60,
					font: P.font.display,
				}),
				cardX,
				cardY,
				{ ...chipPop, scale: chipPop.scale * press * chipAway },
			);
		}
		if (time >= M.tapNewList + 0.12) {
			const grow = settle(time, M.tapNewList + 0.12, 2.2, 6.5);
			const lastTap = tappedPalettes(time).at(-1);
			const squash =
				(lastTap ? wobble(time, M[lastTap[0]], 0.03) : 0) +
				wobble(time, M.yourStyle + 0.42, 0.05);
			const slide = ramp(time, M.yourStyle - 0.35, 0.7, E.inOutCubic) * styleSlide;
			const hop = Math.sin(Math.PI * P.progress(time, M.yourStyle, 0.42)) * 46;
			context.save();
			context.translate(cardX + slide, cardY - hop);
			context.rotate(-0.02 + (1 - grow) * 0.1);
			context.scale((0.25 + grow * 0.75) * (1 + squash), (0.25 + grow * 0.75) * (1 - squash));
			drawCategoryTabs(context, time);
			drawListPaper(context, time, grow);
			drawCategorySwatches(context, time);
			P.handText(context, 'Jana’s birthday', -330, -150, {
				size: 70,
				font: P.font.display,
				color: C.white,
				reveal: ramp(time, M.listTitle, 0.7, E.outQuad),
				time,
			});
			if (time >= M.chooseBirthday + 0.45) {
				drawPop(context, A.cake(), 280, -190, time, M.chooseBirthday + 0.45, {
					scale: 0.34 * shrinkAway(time, M.coverOn + 0.3),
					rotation: 0.1,
				});
			}
			if (time >= coverLanding()) {
				P.draw(
					context,
					coverPrint('card', coverSlots[0].width),
					coverOnCard.x,
					coverOnCard.y,
					{
						scale: coverOnCard.scale,
						rotation: coverOnCard.rotation,
						lift: 1 - ramp(time, coverLanding(), 0.15),
						time,
					},
				);
				P.draw(context, coverTape('cover-card'), coverOnCard.x - 10, coverOnCard.y - 88, {
					rotation: -0.12,
					scale: settle(time, coverLanding() + 0.02, 3, 8) * 0.85,
					time,
					shadowAlpha: 0.1,
				});
			}
			drawPop(context, A.heart(C.sakura, 60), ...styleHeart, time, M.styleStamp, {
				rotation: -0.25,
			});
			context.restore();
		}

		/* occasions */
		occasions.forEach((occasion, index) => {
			const pop = popOptions(time, M[occasion.mark], { rotation: occasion.slot[2] });
			if (!pop) {
				return;
			}
			const leave = ramp(time, M.makeYours - 0.2 + index * 0.05, 0.4, E.inBack);
			const [x, y] = [occasion.slot[0] + leave * 900, occasion.slot[1]];
			P.draw(context, occasionTile(occasion.label), x, y, pop);
			P.draw(context, occasion.make(), x, y - 36, {
				...pop,
				scale: pop.scale * occasion.scale,
				shadowAlpha: 0.2,
			});
			if (index === 0 && time >= M.chooseBirthday && leave < 1) {
				P.drawOn(
					context,
					S.ellipse(x, y, 175, 205, 40, -0.1).concat([[x + 150, y - 150]]),
					ramp(time, M.chooseBirthday, 0.35),
					{ width: 6, color: C.sakura, seed: 41 },
				);
			}
		});
		if (between(time, M.chooseBirthday + 0.1, M.chooseBirthday + 0.5)) {
			const flight = ramp(time, M.chooseBirthday + 0.1, 0.35, E.inOutQuad);
			const [x, y] = arcPath([1300, 264], [cardX + 280, cardY - 190], 260, flight);
			P.draw(context, A.cake(), x, y, {
				scale: P.lerp(0.5, 0.34, flight),
				rotation: flight * 0.1 - (1 - flight) * 0.4,
				lift: 1,
				time,
			});
		}

		/* make it yours: palettes, a cover photo, category colours */
		drawPaletteFan(context, time);
		drawCoverDesk(context, time, cardToWorld);
		sparkleBurst(context, time, M.paletteFive + 0.05, cardX, cardY - 180, {
			count: 7,
			radius: 420,
			seed: 43,
			colors: [C.sakura, C.sun, C.white],
		});
		sparkleBurst(
			context,
			time,
			M.styleStamp,
			cardX + styleSlide + styleHeart[0],
			cardY + styleHeart[1],
			{
				count: 6,
				radius: 260,
				seed: 47,
				colors: [C.sakura, C.sun, C.bright],
			},
		);

		tapArm(context, time, 'jana', [cardX + 40, cardY + 40], M.tapNewList, Math.PI - 0.5);
		tapArm(
			context,
			time,
			'jana',
			paletteTapTarget,
			paletteTaps.map(([mark]) => M[mark]),
			1.25,
		);
	};

	/* ---------- scene 4: add a wish ---------- */
	const wishCardCenter = [740, 610];
	const addWishChip = [1650, 108];
	const wishHeader = () =>
		P.sprite(
			'wish-header',
			W + 80,
			170,
			(context) => {
				const strip = P.torn(S.rect(-(W + 60) / 2, -70, W + 60, 140), 1841, {
					spacing: 8,
					amplitude: 3,
				});
				P.tracePath(context, strip);
				context.fillStyle = P.paperFill(context, C.sakura);
				context.fill();
			},
			{ border: 0, variants: 1 },
		);
	const wishCard = () =>
		P.sprite('wish-card', 1000, 740, (context) => {
			A.part(context, S.roundRect(-480, -350, 960, 700, 34), C.white, {
				seed: 1831,
				shade: 0,
			});
			context.save();
			context.setLineDash([16, 14]);
			context.lineWidth = 4;
			context.strokeStyle = 'rgba(85,185,243,0.75)';
			P.tracePath(context, S.roundRect(-430, -290, 350, 420, 20));
			context.stroke();
			context.restore();
			A.text(context, '+ photo', -255, -80, { size: 44, color: C.bright });
			A.line(
				context,
				[
					[-30, -170],
					[420, -170],
				],
				{ seed: 1832, width: 3, color: C.skyPale, alpha: 1 },
			);
		});
	const socksCard = () =>
		P.sprite('socks-card', 460, 560, (context) => {
			A.part(context, S.roundRect(-210, -260, 420, 520, 30), C.white, {
				seed: 1851,
				shade: 0,
			});
			A.part(context, S.roundRect(-180, -230, 360, 270, 18), C.skyPale, {
				seed: 1852,
				line: 2,
				shade: 0,
			});
			A.text(context, 'Cosy socks', 0, 94, { size: 60, font: P.font.hand });
		});
	const wishLinks = [
		['linkOne', 60, -82, -0.05],
		['linkTwo', 222, -76, 0.04],
		['linkThree', 384, -84, -0.03],
	];
	const starMarks = ['starOne', 'starTwo', 'starThree'];
	const countMarks = ['countOne', 'countTwo', 'countThree'];

	const drawWishScene = (context, time) => {
		drawGridPaper(context, '#f5f9fc');
		P.draw(context, wishHeader(), W / 2, 100, { time, shadowAlpha: 0.2 });
		P.draw(context, coverPrint('thumbnail', 84), 92, 102, {
			rotation: -0.08,
			time,
			shadowAlpha: 0.2,
		});
		P.handText(context, 'Jana’s birthday', 160, 128, {
			size: 66,
			font: P.font.display,
			color: C.white,
			time,
		});
		const chip = popOptions(time, M.addWish, { rotation: 0.03 });
		if (chip) {
			const press = between(time, M.tapAddWish - 0.07, M.tapAddWish + 0.1) ? 0.92 : 1;
			P.draw(
				context,
				A.chip('+ Add wish', {
					color: C.white,
					textColor: C.deep,
					width: 340,
					height: 92,
					size: 54,
					font: P.font.display,
				}),
				addWishChip[0],
				addWishChip[1],
				{ ...chip, scale: chip.scale * press },
			);
		}

		/* the wish card fills in, piece by piece */
		if (time >= M.tapAddWish + 0.1) {
			const travel = ramp(time, M.tapAddWish + 0.1, 0.45, E.outCubic);
			const grow = settle(time, M.tapAddWish + 0.1, 2.2, 6.5);
			const x =
				P.lerp(addWishChip[0], wishCardCenter[0], travel) +
				(1 - ramp(time, M.socks - 0.15, 0.5)) * 220;
			const y = P.lerp(addWishChip[1], wishCardCenter[1], travel);
			context.save();
			context.translate(x, y);
			context.rotate(-0.015);
			context.scale(0.1 + grow * 0.9, 0.1 + grow * 0.9);
			P.draw(context, wishCard(), 0, 0, { time, lift: 1 - travel });
			if (time >= M.photo) {
				const slap = popOptions(time, M.photo, { rotation: -0.06 });
				P.draw(context, A.polaroid(), -255, -70, { ...slap, scale: slap.scale * 1.05 });
				P.draw(context, A.tape(130, 'rgba(255,233,168,0.85)', 'photo'), -255, -240, {
					rotation: 0.08,
					scale: settle(time, M.photo + 0.08, 3, 8),
					time,
					shadowAlpha: 0.1,
				});
			}
			P.handText(context, 'Headphones', -30, -196, {
				size: 104,
				reveal: ramp(time, M.photo + 0.2, 0.6, E.outQuad),
				time,
			});
			wishLinks.forEach(([mark, linkX, linkY, rotation]) =>
				drawPop(context, A.linkChip('link'), linkX, linkY, time, M[mark], {
					scale: 0.58,
					rotation,
				}),
			);
			if (time >= M.price) {
				const slap = popOptions(time, M.price, { rotation: 0.06 });
				P.draw(context, A.priceTag('€79'), 150, 44, { ...slap, scale: slap.scale * 0.85 });
				P.draw(context, A.tape(110, 'rgba(255,233,168,0.85)', 'price'), 44, 18, {
					rotation: -0.7,
					scale: settle(time, M.price + 0.08, 3, 8),
					time,
					shadowAlpha: 0.1,
				});
			}
			starMarks.forEach((mark, index) => {
				if (time < M.starOne - 0.4) {
					return;
				}
				const filled = time >= M[mark];
				const pop = filled ? popOptions(time, M[mark], { rotation: 0 }) : null;
				const appear = settle(time, M.starOne - 0.4 + index * 0.06, 3, 7);
				P.draw(context, A.priorityStar(filled), -10 + index * 96, 196, {
					scale: 0.82 * (pop ? pop.scale * 0.3 + 0.7 : appear),
					rotation: pop ? pop.rotation : 0,
					lift: pop ? pop.lift : 0,
					time,
				});
			});
			drawPop(
				context,
				A.chip('High', { color: C.sunPale, textColor: C.ink }),
				350,
				196,
				time,
				M.priority,
				{
					scale: 0.8,
					rotation: -0.04,
				},
			);
			sparkleBurst(context, time, M.starThree + 0.05, 90, 196, {
				count: 5,
				radius: 200,
				seed: 51,
			});
			context.restore();
		}

		/* socks, times three */
		if (time >= M.socks) {
			const slide = settle(time, M.socks, 2, 6.5);
			const x = P.lerp(2300, 1575, slide);
			const y = 610;
			P.draw(context, socksCard(), x, y, { rotation: 0.035, time, lift: 1 - slide });
			P.draw(context, A.sock(C.mintPale, 'a'), x, y - 96, {
				scale: 0.9,
				rotation: 0.5,
				time,
				shadowAlpha: 0.2,
			});
			const counter = popOptions(time, M.countOne, { rotation: 0.035 });
			if (counter) {
				P.draw(context, A.counter(), x, y + 196, {
					...counter,
					scale: counter.scale * 0.95,
				});
				const count = countMarks.filter((mark) => time >= M[mark]).length;
				const lastTick = [...countMarks].reverse().find((mark) => time >= M[mark]);
				const tickPop = 1 + (1 - settle(time, M[lastTick], 3, 7)) * 0.5;
				context.save();
				context.translate(x + 7, y + 198);
				context.rotate(0.035);
				context.scale(tickPop * counter.scale, tickPop * counter.scale);
				context.font = `700 58px ${P.font.body}`;
				context.textAlign = 'center';
				context.textBaseline = 'middle';
				context.fillStyle = C.ink;
				context.fillText(String(count), 0, 2);
				context.restore();
			}
			tapArm(
				context,
				time,
				'jana',
				[x + 100, y + 206],
				[M.countTwo, M.countThree],
				Math.PI - 0.35,
				420,
			);
			if (time >= M.countThree + 0.2) {
				P.handText(context, '× 3', x + 90, y - 290, {
					size: 110,
					reveal: ramp(time, M.countThree + 0.2, 0.3),
					time,
					rotation: -0.1,
					color: C.deep,
				});
			}
		}
		tapArm(
			context,
			time,
			'jana',
			[addWishChip[0] - 20, addWishChip[1] + 20],
			M.tapAddWish,
			0.4,
		);
	};

	/* ---------- scene 5: one link to everyone ---------- */
	const friends = [
		{
			name: 'grandma',
			x: 400,
			at: 'grandma',
			appear: 0,
			accent: C.sakura,
			app: () => A.chatBubble(C.mintPale, 'grandma'),
		},
		{
			name: 'friend',
			x: 960,
			at: 'friend',
			appear: 0.14,
			accent: C.mint,
			app: () => A.chatBubble(C.skyPale, 'friend'),
		},
		{
			name: 'aunt',
			x: 1520,
			at: 'aunt',
			appear: 0.28,
			accent: '#efa00b',
			app: () => A.envelope(C.sunPale),
		},
	];
	const appMarks = ['appOne', 'appTwo', 'appThree'];
	const phonePosition = (friend) => [friend.x + 140, 830];
	const foldPoint = [960, 560];
	const planePath = S.bezier(
		[
			[960, 560],
			[780, 260],
			[330, 160],
			[400, 420],
			[470, 650],
			[880, 610],
			[1080, 440],
			[1260, 280],
			[1160, 110],
			[960, 260],
		],
		40,
	);

	const drawShareScene = (context, time) => {
		skyBackground(context, time, { sunX: 1700, sunY: 170 });
		drawTown(context, time, settle(time, M.fold, 1.6, 6));

		/* the whole wish page folds itself into a paper plane */
		const fold = ramp(time, M.fold, 0.5, E.inCubic);
		if (fold < 1) {
			context.save();
			context.translate(foldPoint[0], foldPoint[1]);
			context.rotate(fold * 0.7);
			context.scale(1 - fold * 0.97, 1 - fold * 0.985);
			context.translate(-foldPoint[0], -foldPoint[1]);
			sheetShadow(context);
			drawWishScene(context, time);
			context.restore();
		}

		friends.forEach((friend, index) => {
			const rise = settle(time, M.fold + 1.15 + friend.appear, 1.9, 6);
			if (rise <= 0) {
				return;
			}
			const ding = time - M[friend.at];
			const pose = {
				expression: ding > 0 ? 'grin' : 'smile',
				look: index === 0 ? 1 : index === 2 ? -1 : 0,
				headTilt:
					Math.sin(time * 2 + index) * 0.05 +
					(ding > 0 && ding < 0.4 ? Math.sin(ding * 20) * 0.06 : 0),
				bob: Math.sin(time * 3 + index * 1.7) * 5,
				blink: blinkAt(time, index * 1.1),
				rightHand: [150, -200],
				rightGrip: true,
				leftHand: [-176, -14],
				prop: (layerContext, hands) =>
					P.draw(
						layerContext,
						A.phone(friend.accent, friend.name, 'Jana’s wishes'),
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
				const [x, y] = phonePosition(friend);
				const burst = E.outCubic(P.clamp(ding / 0.5));
				const rayAlpha = 1 - P.clamp((ding - 0.4) / 0.5);
				for (let ray = 0; ray < 8; ray++) {
					const angle = (ray / 8) * Math.PI * 2;
					P.pencil(
						context,
						[
							[
								x + Math.cos(angle) * (60 + burst * 40),
								y + Math.sin(angle) * (60 + burst * 40),
							],
							[
								x + Math.cos(angle) * (90 + burst * 70),
								y + Math.sin(angle) * (90 + burst * 70),
							],
						],
						{ width: 5, color: C.deep, seed: ray, gaps: false, alpha: rayAlpha },
					);
				}
			}
			const app = popOptions(time, M[appMarks[index]], { rotation: (index - 1) * 0.08 });
			if (app) {
				const away = shrinkAway(time, M.registration - 0.25 + index * 0.05);
				const [x, y] = phonePosition(friend);
				P.draw(context, friend.app(), x + 110, y - 250 + Math.sin(time * 2.4 + index) * 6, {
					...app,
					scale: app.scale * 0.72 * away,
				});
			}
		});

		/* one plane towing one link, then three little planes to the phones */
		if (time >= M.fold + 0.35 && time < M.split) {
			const appear = settle(time, M.fold + 0.35, 3, 7);
			const flight = ramp(time, M.planeFly, M.split - M.planeFly, E.inOutSine);
			const [x, y] = pathPoint(planePath, flight);
			const [nextX, nextY] = pathPoint(planePath, Math.min(1, flight + 0.01));
			const heading = Math.atan2(nextY - y, nextX - x);
			context.save();
			context.setLineDash([14, 14]);
			context.strokeStyle = C.deep;
			context.lineWidth = 4;
			context.lineCap = 'round';
			P.tracePath(
				context,
				planePath
					.slice(0, Math.floor(flight * (planePath.length - 1)) + 1)
					.concat([[x, y]]),
				false,
			);
			context.stroke();
			context.restore();
			if (flight > 0.02) {
				const [chipX, chipY] = pathPoint(planePath, Math.max(0, flight - 0.07));
				const tailX = x - Math.cos(heading) * 70;
				const tailY = y - Math.sin(heading) * 70;
				P.pencil(
					context,
					S.bezier(
						[
							[tailX, tailY],
							[P.lerp(tailX, chipX, 0.35), P.lerp(tailY, chipY, 0.35) + 26],
							[P.lerp(tailX, chipX, 0.7), P.lerp(tailY, chipY, 0.7) + 26],
							[chipX, chipY],
						],
						12,
					),
					{ width: 3, color: C.inkSoft, seed: 61, gaps: false },
				);
				const [previousX, previousY] = pathPoint(planePath, Math.max(0, flight - 0.08));
				P.draw(context, A.linkChip('one link'), chipX, chipY, {
					scale: 0.62 * P.clamp((flight - 0.02) / 0.04),
					rotation: Math.atan2(chipY - previousY, chipX - previousX) * 0.35,
					time,
					lift: 0.5,
				});
			}
			P.draw(context, A.paperPlane(), x, y, {
				scale: 0.72 * appear,
				rotation: heading,
				time,
				lift: 0.8,
			});
		}
		sparkleBurst(context, time, M.split, 960, 260, { count: 8, radius: 300, seed: 63 });
		if (time >= M.split) {
			friends.forEach((friend) => {
				const arrive = M[friend.at];
				const amount = ramp(time, M.split, arrive - M.split, E.inOutSine);
				const [targetX, targetY] = phonePosition(friend);
				const from = [960, 260];
				const to = [targetX, targetY - 90];
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
					const [x, y] = arcPath(from, to, 120, amount);
					const [nextX, nextY] = arcPath(from, to, 120, Math.min(1, amount + 0.02));
					P.draw(context, A.paperPlane(), x, y, {
						scale: 0.42,
						rotation: Math.atan2(nextY - y, nextX - x),
						time,
						lift: 0.6,
					});
				}
			});
		}

		/* no account needed */
		if (time >= M.registration) {
			const drop = settle(time, M.registration, 1.8, 6.5);
			const cardY = P.lerp(-300, 330, drop);
			P.draw(context, A.registrationCard('Sign up', ['Email', 'Password']), 960, cardY, {
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
				P.draw(context, A.badge(['no', 'account'], C.mint), 1260, cardY + 100, {
					scale: slam * 0.82,
					rotation: 0.18,
					lift: P.clamp(1 - local / 0.12),
					time,
				});
			}
		}
	};

	/* ---------- scene 6: reservations ---------- */
	const cardSlots = [
		[300, 610, -0.05],
		[740, 590, 0.03],
		[1180, 615, -0.02],
		[1620, 595, 0.05],
	];
	/* where the aunt's hand settles after pulling back from the taken headphones */
	const auntRecoil = { position: [cardSlots[0][0] + 240, cardSlots[0][1] - 380], angle: -0.45 };
	const stampMoves = [
		{ who: 'grandma', card: 0, mark: 'stampOne', angle: 0.25 },
		{ who: 'friend', card: 1, mark: 'stampTwo', angle: -0.1 },
		{
			who: 'aunt',
			card: 2,
			mark: 'stampThree',
			angle: -0.3,
			from: auntRecoil.position,
			fromAngle: auntRecoil.angle,
		},
	];

	const drawReserveScene = (context, time) => {
		drawGridPaper(context);
		const [shakeX, shakeY] = stampMoves.reduce(
			(sum, move) => {
				const [x, y] = shakeAt(time, M[move.mark], 7, 0.25);
				return [sum[0] + x, sum[1] + y];
			},
			[0, 0],
		);
		context.save();
		context.translate(shakeX, shakeY);
		cardItems.forEach((item, index) => {
			const [x, y, rotation] = cardSlots[index];
			const pop = popOptions(time, M.cards + 0.05 + index * 0.09, { rotation });
			if (!pop) {
				return;
			}
			const blocked = index === 0 ? time - M.blocked : -1;
			const wiggle =
				blocked > 0 && blocked < 0.5
					? Math.sin(blocked * 40) * 0.05 * (1 - blocked / 0.5)
					: 0;
			const move = stampMoves.find((candidate) => candidate.card === index);
			drawCard(context, item, x, y, {
				scale: pop.scale * 1.1,
				rotation: pop.rotation + wiggle,
				time,
				lift: pop.lift,
				stamped: move ? time - M[move.mark] : null,
			});
		});

		/* the aunt reaches for the headphones, sees they are taken, and picks something else */
		if (time >= M.reach && time < M.stampThree - 0.42) {
			const toward = ramp(time, M.reach, M.blocked - M.reach, E.outCubic);
			const recoil = ramp(time, M.blocked, 0.3, E.outBack);
			const [slotX, slotY] = cardSlots[0];
			const [recoilX, recoilY] = auntRecoil.position;
			const x = P.lerp(P.lerp(slotX + 700, slotX + 60, toward), recoilX, recoil);
			const y = P.lerp(P.lerp(-700, slotY - 320, toward), recoilY, recoil);
			P.reachingArm(context, 'aunt', x, y, P.lerp(-0.55, auntRecoil.angle, recoil), {
				time,
				hold: holdStamp(time),
			});
		}
		if (time > M.blocked) {
			const [slotX, slotY] = cardSlots[0];
			const fade = 1 - ramp(time, M.stampThree + 0.6, 0.4);
			P.handText(context, 'already taken', slotX - 170, slotY - 330, {
				size: 62,
				reveal: ramp(time, M.blocked, 0.25),
				time,
				rotation: -0.06,
				color: C.deep,
				alpha: fade,
			});
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
			const alpha = 1 - ramp(time, M.stampThree + 0.6, 0.4);
			P.drawOn(context, arrow, draw, { width: 5, color: C.deep, seed: 61, alpha });
			if (draw >= 1) {
				P.pencil(
					context,
					[
						[toX - 70, toY - 270],
						[toX - 30, toY - 240],
						[toX - 20, toY - 290],
					],
					{ width: 5, color: C.deep, seed: 62, gaps: false, alpha },
				);
			}
		}
		for (const move of stampMoves) {
			const [x, y] = cardSlots[move.card];
			drawStampArm(context, time, move.who, [x, y], M[move.mark], move.angle, move);
		}
		sparkleBurst(context, time, M.stampThree + 0.1, cardSlots[2][0], cardSlots[2][1], {
			count: 6,
			radius: 260,
			seed: 7,
		});

		/* never bought twice */
		if (time >= M.twice) {
			P.handText(context, '2×', 960, 200, {
				size: 150,
				align: 'center',
				reveal: ramp(time, M.twice, 0.3),
				time,
				rotation: -0.06,
				color: C.ink,
			});
			const slash = ramp(time, M.twiceSlash, 0.4, E.outQuad);
			P.drawOn(
				context,
				S.ellipse(965, 150, 120, 100, 40, -0.2).concat([[1080, 110]]),
				slash * 1.6,
				{
					width: 8,
					color: C.coral,
					seed: 65,
				},
			);
			P.drawOn(
				context,
				[
					[885, 225],
					[1050, 80],
				],
				slash * 2.5 - 1.5,
				{ width: 8, color: C.coral, seed: 66 },
			);
		}
		context.restore();
	};

	/* ---------- scene 7: like a wish, hear when it is reserved ---------- */
	const heartCard = { x: 720, y: 570, scale: 1.7 };
	const heartSpot = [heartCard.x + 100 * heartCard.scale, heartCard.y - 136 * heartCard.scale];
	const drawHeartScene = (context, time) => {
		drawGridPaper(context, '#f3f9fd');
		drawCard(context, cardItems[3], heartCard.x, heartCard.y, {
			scale: heartCard.scale,
			rotation: -0.03,
			time,
			stamped: time - M.heartStamp,
		});
		const liked = time >= M.heartTap;
		if (!liked) {
			P.draw(context, A.heartOutline(40), heartSpot[0], heartSpot[1], { scale: 1.2, time });
		} else {
			const pop = popOptions(time, M.heartTap, { rotation: 0.08 });
			P.draw(context, A.heart(C.sakura, 40), heartSpot[0], heartSpot[1], {
				...pop,
				scale: pop.scale * 1.2,
			});
			for (let index = 0; index < 5; index++) {
				const local = time - M.heartTap - index * 0.12;
				if (local < 0 || local > 1.6) {
					continue;
				}
				P.draw(
					context,
					A.heart(index % 2 ? C.coral : C.sakura, 26),
					heartSpot[0] + (index - 2) * 38 + Math.sin(local * 4 + index) * 14,
					heartSpot[1] - 40 - local * 180,
					{
						scale: Math.min(1, local * 5) * (1 - P.clamp((local - 1.1) / 0.5)),
						rotation: Math.sin(local * 5) * 0.2,
						time,
						shadowAlpha: 0.15,
					},
				);
			}
			sparkleBurst(context, time, M.heartTap, heartSpot[0], heartSpot[1], {
				count: 7,
				radius: 200,
				seed: 71,
				colors: [C.sakura, C.sun, C.white],
			});
		}
		tapArm(context, time, 'friend', [heartSpot[0] + 10, heartSpot[1] + 16], M.heartTap, 0.55);
		drawStampArm(context, time, 'aunt', [heartCard.x, heartCard.y + 20], M.heartStamp, -0.35, {
			scale: 1.1,
		});

		/* the friend who liked it gets told */
		const rise = settle(time, M.heartStamp - 0.7, 1.9, 6);
		if (rise > 0) {
			const told = time - M.notify;
			P.puppet(
				context,
				'friend',
				1470,
				1160 - rise * 180,
				{
					expression: told > 0.1 ? 'grin' : 'smile',
					look: told > 0 ? 0 : -1,
					headTilt:
						told > 0 && told < 0.6
							? Math.sin(told * 16) * 0.06
							: Math.sin(time * 2) * 0.04,
					bob: Math.sin(time * 3) * 5,
					blink: blinkAt(time, 0.7),
					rightHand: [150, -200],
					rightGrip: true,
					prop: (layerContext, hands) =>
						P.draw(
							layerContext,
							A.phone(C.mint, 'friend', 'Jana’s wishes'),
							hands.rightHand[0] + 34,
							hands.rightHand[1] - 62,
							{ scale: 0.62, rotation: 0.14, time, shadowAlpha: 0.15 },
						),
				},
				{ scale: 0.95, time },
			);
		}
		if (time >= M.notify) {
			const drop = settle(time, M.notify, 2.4, 6.5);
			const ring = time - M.notify;
			P.draw(
				context,
				A.notification('Someone reserved a gift you like'),
				1420,
				P.lerp(-140, 190, drop),
				{
					rotation: ring < 0.8 ? Math.sin(ring * 30) * 0.02 * (1 - ring / 0.8) : 0,
					time,
					lift: 1 - drop,
				},
			);
			sparkleBurst(context, time, M.notify + 0.15, 1420, 190, {
				count: 6,
				radius: 520,
				seed: 73,
			});
		}
	};

	/* ---------- scene 8: your view stays surprise-free ---------- */
	const secretSlots = [
		[1235, 320, -0.06],
		[1605, 330, 0.05],
		[1235, 770, 0.04],
		[1605, 760, -0.04],
	];
	const lensFrames = () => [
		[M.magnifier, 1950, 1250],
		[M.magnifier + 0.4, 1235, 330],
		[M.magnifier + 0.7, 1235, 330],
		[M.magnifier + 1.0, 1605, 340],
		[M.magnifier + 1.3, 1605, 340],
		[M.magnifier + 1.6, 1235, 770],
		[M.lensOut, 1235, 770],
		[M.lensOut + 0.4, 1950, 1400],
	];
	const lensScale = 0.95;
	const drawSecretCards = (context, time, { stamps }) =>
		cardItems.forEach((item, index) => {
			const [x, y, rotation] = secretSlots[index];
			const pop = popOptions(time, M.secretScene + 0.35 + index * 0.07, { rotation });
			if (!pop) {
				return;
			}
			drawCard(context, item, x, y, {
				scale: pop.scale * 0.64,
				rotation: pop.rotation,
				time,
				stamped: stamps ? 1 : null,
				flip: ramp(time, M.flip + index * 0.2, 0.3, E.inOutQuad),
			});
		});

	const drawSecretScene = (context, time) => {
		skyBackground(context, time, { sun: false });
		drawSecretCards(context, time, { stamps: true });

		/* the magnifier shows Jana's own view: her wishes, without reservations */
		if (between(time, M.magnifier, M.lensOut + 0.4)) {
			const [lensX, lensY] = along(time, lensFrames());
			const radius = 176 * lensScale;
			context.save();
			P.tracePath(context, S.ellipse(lensX, lensY, radius, radius, 60));
			context.clip();
			context.fillStyle = P.paperFill(context, '#eef7fd');
			context.fillRect(lensX - radius, lensY - radius, radius * 2, radius * 2);
			context.translate(lensX, lensY);
			context.scale(1.18, 1.18);
			context.translate(-lensX, -lensY);
			drawSecretCards(context, time, { stamps: false });
			context.restore();
			P.pencil(
				context,
				S.ellipse(lensX, lensY, radius * 0.78, radius * 0.78, 40).slice(26, 34),
				{
					width: 8,
					color: C.white,
					seed: 81,
					gaps: false,
					alpha: 0.35,
				},
			);
			const tilt = -0.3;
			const magnifier = A.magnifier();
			P.draw(context, magnifier, lensX, lensY, {
				scale: lensScale,
				rotation: tilt,
				anchorY: 0.5 - 120 / magnifier.height,
				time,
				lift: 0.5,
			});
			P.reachingArm(
				context,
				'jana',
				lensX + Math.sin(-tilt) * 360 * lensScale,
				lensY + Math.cos(tilt) * 360 * lensScale,
				Math.PI + tilt,
				{ time },
			);
			const tagIn = ramp(time, M.magnifier + 0.45, 0.35);
			if (tagIn > 0) {
				P.handText(context, 'your view', lensX - 250, lensY - 200, {
					size: 64,
					reveal: tagIn,
					time,
					rotation: -0.1,
					color: C.deep,
					alpha: 1 - ramp(time, M.lensOut - 0.1, 0.2),
				});
			}
		}

		const rise = settle(time, M.secretScene + 0.15, 2, 6);
		const cover = ramp(time, M.coverEyes, 0.22, E.outBack);
		const peek = between(time, M.psst + 0.2, M.psst + 0.9)
			? Math.sin(((time - M.psst - 0.2) / 0.7) * Math.PI)
			: 0;
		const eyesLeft = [-66, -350 + peek * 46];
		const eyesRight = [66, -350];
		const pose = {
			expression: time < M.coverEyes ? 'smile' : 'grin',
			look: time < M.coverEyes ? 1 : 0,
			headTilt: time < M.coverEyes ? 0.06 : Math.sin(time * 4) * 0.04,
			bob: bounce(time) * 8,
			blink: blinkAt(time, 0.2),
			leftHand: [P.lerp(-176, eyesLeft[0], cover), P.lerp(-14, eyesLeft[1], cover)],
			rightHand: [P.lerp(176, eyesRight[0], cover), P.lerp(-14, eyesRight[1], cover)],
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
		P.puppet(context, 'jana', 520, 1200 - rise * 150, pose, {
			scale: 1.12,
			time,
			lift: 1 - rise,
		});
		if (time >= M.psst) {
			const pop = popOptions(time, M.psst, { rotation: 0.05 });
			P.draw(context, A.speechBubble('shh!', 300, 'shh'), 860, 330, {
				...pop,
				scale: pop.scale * 0.85,
			});
		}
		for (let index = 0; index < 5; index++) {
			const local = time - (M.coverEyes + 0.4 + index * 0.45);
			if (local < 0 || local > 2.6) {
				continue;
			}
			P.draw(
				context,
				A.heart(index % 2 ? C.sakura : C.coral, 34),
				520 + (index % 2 ? 1 : -1) * (180 + index * 20) + Math.sin(local * 3 + index) * 20,
				520 - local * 170,
				{
					scale: Math.min(1, local * 4) * (1 - P.clamp((local - 2) / 0.6)),
					rotation: Math.sin(local * 4) * 0.2,
					time,
					shadowAlpha: 0.2,
				},
			);
		}
	};

	/* ---------- scenes 9 + 10: Rosie's list, managed together, then handed over ---------- */
	const nurseryWall = () =>
		P.sprite(
			'nursery-wall',
			W + 80,
			H + 80,
			(context) => {
				const width = W + 80;
				const height = H + 80;
				context.fillStyle = P.paperFill(context, '#e2f1fb');
				context.fillRect(-width / 2, -height / 2, width, height);
				for (let row = 0; row < 8; row++) {
					for (let column = 0; column < 13; column++) {
						const x = -width / 2 + 40 + column * 160 + (row % 2) * 80;
						const y = -height / 2 + 50 + row * 125;
						P.tracePath(context, S.star(x, y, 13, 5.5, 5, -Math.PI / 2 + row * 0.3));
						context.fillStyle = 'rgba(255,255,255,0.85)';
						context.fill();
					}
				}
				const floor = P.torn(S.rect(-width / 2, 330, width, 300), 44, {
					spacing: 7,
					amplitude: 3,
				});
				P.tracePath(context, floor);
				context.fillStyle = P.paperFill(context, C.mintPale);
				context.fill();
			},
			{ border: 0, variants: 1 },
		);
	const kidsPage = () =>
		P.sprite('kids-page', 620, 700, (context) => {
			A.part(context, S.rect(-300, -340, 600, 680), '#fff3dc', { seed: 851, shade: 0 });
			for (let index = 0; index < 5; index++) {
				A.part(
					context,
					S.star(-230 + index * 115, 300 - (index % 2) * 20, 22, 9),
					[C.sun, C.sky, C.coral, C.mint, C.sakura][index],
					{ seed: 852 + index, line: 2, cut: false },
				);
			}
		});
	const kidsPageSpot = { x: 1150, y: 430, scale: 0.8 };
	const kidsItems = [
		{
			make: () => A.kite(),
			x: 150,
			y: -30,
			scale: 0.78,
			rotation: 0.12,
			pop: 0.3,
			stamp: 'kidsStampOne',
			stampY: 95,
			tick: [250, 175],
		},
		{
			make: () => A.book('Dinosaurs'),
			x: -140,
			y: 30,
			scale: 0.9,
			rotation: -0.08,
			pop: 0.5,
			stamp: 'kidsStampTwo',
			stampY: 150,
			tick: [30, 205],
		},
	];
	const tickMarks = ['tickOne', 'tickTwo'];
	const tickStroke = ([x, y]) => [
		[x - 26, y - 6],
		[x - 6, y + 18],
		[x + 34, y - 34],
	];

	const drawKidsPage = (context, time) => {
		const enter = settle(time, M.kidsList, 2, 6.5);
		if (enter <= 0) {
			return;
		}
		const leave = ramp(time, M.kidsListOut, 0.4, E.inBack);
		if (leave >= 1) {
			return;
		}
		context.save();
		context.translate(
			kidsPageSpot.x + leave * 1100,
			P.lerp(-500, kidsPageSpot.y, enter) - leave * 200,
		);
		context.rotate(0.04 + leave * 0.5);
		context.scale(kidsPageSpot.scale, kidsPageSpot.scale);
		drawKidsPageContent(context, time, 1 - enter);
		context.restore();
	};

	/* Rosie's page, drawn around the origin so it can also fly into her phone later. */
	const drawKidsPageContent = (context, time, lift) => {
		P.draw(context, kidsPage(), 0, 0, { time, lift });
		P.draw(context, A.tape(150, 'rgba(159,220,191,0.8)', 'kids'), 0, -335, {
			rotation: 0.05,
			time,
			shadowAlpha: 0.1,
		});
		P.handText(context, 'Rosie’s wishes', -240, -220, {
			size: 92,
			reveal: ramp(time, M.kidsList + 0.2, 0.5),
			time,
			color: C.coral,
		});
		kidsItems.forEach((item) => {
			drawPop(context, item.make(), item.x, item.y, time, M.kidsList + item.pop, {
				scale: item.scale,
				rotation: item.rotation,
			});
			drawStampMark(
				context,
				time - M[item.stamp],
				item.x,
				item.y + item.stampY,
				0.55,
				-0.2,
				time,
			);
		});
		kidsItems.forEach((item, index) => {
			const start = M[tickMarks[index]];
			if (time < start) {
				return;
			}
			P.drawOn(context, tickStroke(item.tick), ramp(time, start, 0.22, E.outQuad), {
				width: 7,
				color: C.leaf,
				seed: 95 + index,
			});
		});
		drawPop(context, A.heart(C.sakura, 44), 230, -250, time, M.planHeart, { rotation: 0.15 });
		if (between(time, M.tickOne - 0.25, M.planHeart + 0.4)) {
			const targets = [
				[M.tickOne - 0.25, ...tickStroke(kidsItems[0].tick)[0]],
				[M.tickOne + 0.22, ...tickStroke(kidsItems[0].tick)[2]],
				[M.tickTwo, ...tickStroke(kidsItems[1].tick)[0]],
				[M.tickTwo + 0.22, ...tickStroke(kidsItems[1].tick)[2]],
				[M.planHeart, 230, -250],
				[M.planHeart + 0.4, 600, -700],
			];
			const [x, y] = along(time, targets);
			const pencil = A.pencilTool();
			P.draw(context, pencil, x, y, {
				rotation: 0.45,
				anchorY: 0.5 + 186 / pencil.height,
				time,
				lift: 0.5,
				scale: 1.1,
			});
		}
	};

	const rosieGrowth = (time) =>
		[0, 0.5, 1].reduce((sum, offset) => sum + settle(time, M.grow + offset, 3, 7), 0) / 3;
	const rosieBase = [660, 1080];
	const rosieLook = (growth) => ({
		scale: P.lerp(0.56, 0.9, growth),
		headScale: P.lerp(1.3, 1.05, growth),
	});
	const rosieHeadTop = (growth) => {
		const { scale, headScale } = rosieLook(growth);
		return rosieBase[1] + (-262 - 262 * headScale) * scale;
	};
	const rosiePhone = (growth) => {
		const { scale } = rosieLook(growth);
		return [rosieBase[0] + 184 * scale, rosieBase[1] - 262 * scale];
	};
	const heightMarks = [
		[-0.05, 0, '3'],
		[0.45, 1 / 3, '7'],
		[0.95, 2 / 3, '10'],
		[1.45, 1, '14'],
	];
	const janaHand = [520, 800];
	const grandmaHand = [1460, 800];

	const drawNurseryScene = (context, time) => {
		P.draw(context, nurseryWall(), W / 2, H / 2, { shadowAlpha: 0, time });
		drawPop(context, frameSprite(), 1660, 230, time, M.rosieScene + 0.3, {
			scale: 0.75,
			rotation: -0.04,
		});

		/* the height chart counts the years */
		const chart = popOptions(time, M.heightChart, { rotation: 0.01 });
		if (chart) {
			P.draw(context, A.heightChart(), 860, 560, { ...chart, scale: chart.scale * 0.92 });
			heightMarks.forEach(([offset, growth, age], index) => {
				const start = M.grow + offset;
				if (time < start) {
					return;
				}
				const y = rosieHeadTop(growth);
				P.drawOn(
					context,
					[
						[790, y],
						[930, y - 3],
					],
					ramp(time, start, 0.15),
					{ width: 5, color: C.coral, seed: 101 + index },
				);
				P.handText(context, age, 945, y + 14, {
					size: 44,
					reveal: ramp(time, start + 0.08, 0.15),
					time,
					color: C.deep,
				});
			});
		}

		drawKidsPage(context, time);

		/* Jana */
		const janaRise = settle(time, M.rosieScene + 0.2, 2, 6.5);
		const giving =
			between(time, M.invite - 0.3, M.inviteLand) ||
			between(time, M.handOver - 0.3, M.claimLand);
		const leanIn = between(time, M.tickOne - 0.3, M.planHeart + 0.8) ? 0.05 : 0;
		P.puppet(
			context,
			'jana',
			330,
			1340 - janaRise * 260,
			{
				expression:
					time > M.planHeart || between(time, M.handOver, M.phoneZoom) ? 'grin' : 'smile',
				look: 1,
				headTilt: Math.sin(time * 2.1) * 0.04 + leanIn,
				lean: leanIn,
				bob: Math.sin(time * 3) * 4,
				blink: blinkAt(time, 0.3),
				rightHand: giving ? [200, -300] : [176, -14],
			},
			{ scale: 0.95, time },
		);

		/* Rosie, small with a teddy, later grown with a phone */
		const growth = rosieGrowth(time);
		const { scale: rosieScale, headScale } = rosieLook(growth);
		const withPhone = time >= M.grow + 0.8;
		const playing = between(time, M.kidsStampOne - 0.3, M.planHeart + 0.3);
		const rosieIn = settle(time, M.rosie, 2.4, 6.5);
		if (rosieIn > 0) {
			const zoomed = time >= M.phoneZoom;
			P.puppet(
				context,
				'rosie',
				rosieBase[0],
				rosieBase[1] + (1 - rosieIn) * 380,
				{
					expression:
						time > M.hide + 0.9
							? 'happyClosed'
							: playing || time < M.invite
								? 'grin'
								: 'smile',
					look: playing ? -1 : withPhone && !zoomed ? 0.4 : 1,
					headScale,
					headTilt: Math.sin(time * 2.6) * 0.05 + (playing ? -0.08 : 0),
					bob: bounce(time) * 6,
					blink: blinkAt(time, 1.3),
					leftHand: withPhone ? [-176, -14] : [-70, -170],
					rightHand: withPhone ? [150, -200] : [70, -170],
					rightGrip: withPhone,
					prop: (layerContext, hands) => {
						if (withPhone) {
							const pop = popOptions(time, M.grow + 0.8);
							P.draw(
								layerContext,
								A.phone(C.coral, 'rosie', 'Rosie’s wishes'),
								hands.rightHand[0] + 34,
								hands.rightHand[1] - 62,
								{
									...pop,
									scale: pop.scale * 0.62,
									rotation: 0.14,
									shadowAlpha: 0.15,
								},
							);
						} else {
							P.draw(layerContext, A.teddy(), 0, -170, {
								scale: 0.85,
								rotation: playing ? Math.sin(time * 7) * 0.18 : -0.06,
								time,
								shadowAlpha: 0.15,
							});
						}
					},
				},
				{ scale: rosieScale, time },
			);
			sparkleBurst(context, time, M.rosie + 0.1, rosieBase[0], 760, {
				count: 6,
				radius: 260,
				seed: 111,
			});
		}

		/* Grandma, who becomes a manager */
		const grandmaRise = settle(time, M.rosieScene + 0.35, 2, 6.5);
		const holdingInvite = between(time, M.inviteLand, M.manager);
		P.puppet(
			context,
			'grandma',
			1650,
			1340 - grandmaRise * 260,
			{
				expression: time > M.inviteLand ? 'grin' : 'smile',
				look: -1,
				headTilt: Math.sin(time * 2.3 + 1) * 0.04 - leanIn,
				lean: -leanIn,
				bob: Math.sin(time * 3 + 2) * 4,
				blink: blinkAt(time, 1.7),
				leftHand:
					holdingInvite || between(time, M.invite - 0.2, M.inviteLand)
						? [-200, -300]
						: [-176, -14],
				prop: (layerContext) => {
					const pin = popOptions(time, M.manager, { rotation: -0.1 });
					if (pin) {
						P.draw(layerContext, A.rosette(), -80, -170, {
							...pin,
							scale: pin.scale * 0.62,
						});
					}
				},
			},
			{ scale: 0.95, time },
		);
		if (time >= M.manager) {
			sparkleBurst(context, time, M.manager, 1570, 850, { count: 6, radius: 220, seed: 113 });
		}

		/* tickets: the invite to Grandma, the claim link to Rosie */
		const ticketFlight = (label, color, start, land, from, to, height, holdUntil) => {
			const appear = popOptions(time, start - 0.3, { rotation: -0.1 });
			if (!appear || time > holdUntil) {
				return;
			}
			const flight = ramp(time, start, land - start, E.inOutQuad);
			const [x, y] = arcPath(from, to, height, flight);
			const fade = 1 - ramp(time, holdUntil - 0.2, 0.2);
			P.draw(context, A.ticket(label, color), x, y - 40, {
				...appear,
				scale: appear.scale * 0.62 * fade,
				rotation: appear.rotation + Math.sin(flight * Math.PI) * 0.5,
				lift: flight < 1 ? Math.sin(flight * Math.PI) : 0,
			});
		};
		ticketFlight(
			'Invite',
			C.sunPale,
			M.invite,
			M.inviteLand,
			janaHand,
			grandmaHand,
			480,
			M.manager + 0.1,
		);
		ticketFlight(
			'Claim link',
			C.mintPale,
			M.handOver,
			M.claimLand,
			janaHand,
			rosiePhone(1),
			260,
			M.claimLand + 0.35,
		);
		sparkleBurst(context, time, M.claimLand, ...rosiePhone(1), {
			count: 7,
			radius: 240,
			seed: 115,
		});

		/* the list flies into Rosie's phone */
		if (between(time, M.listToPhone, M.listInPhone)) {
			const flight = ramp(time, M.listToPhone, M.listInPhone - M.listToPhone, E.inOutCubic);
			const [x, y] = arcPath([1450, -380], rosiePhone(1), -120, flight);
			const scale = P.lerp(0.55, 0.05, E.inQuad(flight));
			context.save();
			context.translate(x, y);
			context.rotate(0.3 - flight * 0.9);
			context.scale(scale, scale);
			drawKidsPageContent(context, time, 1);
			context.restore();
		}

		/* Rosie's own view: reservations tuck themselves away */
		if (time >= M.phoneZoom) {
			const grow = settle(time, M.phoneZoom, 2.2, 6.5);
			const travel = ramp(time, M.phoneZoom, 0.4, E.outCubic);
			const [startX, startY] = rosiePhone(1);
			const phoneScale = P.lerp(0.56, 2.05, grow);
			context.save();
			context.translate(P.lerp(startX, 1240, travel), P.lerp(startY - 62, 520, travel));
			context.rotate(P.lerp(0.14, 0.03, travel));
			context.scale(phoneScale, phoneScale);
			P.draw(context, A.phone(C.coral, 'rosie', 'Rosie’s wishes'), 0, 0, {
				time,
				lift: 1 - travel,
			});
			[0, 1, 2].forEach((row) => {
				const y = -56 + row * 52;
				const hideAt = M.hide + row * 0.3;
				const chip = popOptions(time, M.phoneZoom + 0.35 + row * 0.08);
				if (chip && time < hideAt + 0.15) {
					P.draw(
						context,
						A.chip('reserved', {
							color: C.mintPale,
							textColor: '#0b6e49',
							width: 120,
							height: 34,
							size: 22,
							font: P.font.body,
						}),
						26,
						y,
						{
							...chip,
							scale: chip.scale * shrinkAway(time, hideAt, 0.15),
							shadowAlpha: 0.1,
						},
					);
				}
				const gift = popOptions(time, hideAt + 0.1, { rotation: (row - 1) * 0.12 });
				if (gift) {
					A.drawGift(context, 30, y + 6, {
						color: [C.sky, C.sakura, C.mint][row],
						ribbon: C.sun,
						key: 'dots',
						scale: gift.scale * 0.17,
						rotation: gift.rotation,
						time,
						lift: gift.lift,
					});
				}
			});
			context.restore();
			sparkleBurst(context, time, M.hide + 0.8, 1240, 520, {
				count: 7,
				radius: 380,
				seed: 117,
			});
		}
	};

	/* ---------- scene 11: after the celebration ---------- */
	const boardCenter = [1280, 400];
	const boardSlots = [
		[1090, 300, -0.03],
		[1470, 300, 0.03],
		[1090, 560, 0.02],
		[1470, 560, -0.03],
	];
	const pocketCenter = [1280, 910];
	const pocketHinge = [1280, 790];
	const pocketFan = [
		[-110, -0.12],
		[-38, -0.04],
		[38, 0.05],
		[110, 0.13],
	];
	const listBoard = () =>
		P.sprite('list-board', 820, 640, (context) => {
			const outline = A.part(context, S.roundRect(-390, -300, 780, 600, 30), C.white, {
				seed: 1861,
				shade: 0,
			});
			context.save();
			P.tracePath(context, outline);
			context.clip();
			P.piece(context, S.rect(-400, -320, 800, 108), C.sakura, { seed: 1862, shade: 0.5 });
			context.restore();
			A.text(context, 'Jana’s birthday', -350, -258, {
				size: 50,
				font: P.font.display,
				color: C.white,
				align: 'left',
			});
		});

	const drawPartyScene = (context, time) => {
		skyBackground(context, time, { sun: true, sunX: 1760, sunY: 170 });
		P.draw(context, A.bunting(1900), W / 2, 90, {
			shadowAlpha: 0.2,
			rotation: Math.sin(time * 1.2) * 0.005,
			time,
		});
		[C.sky, C.mint, C.sakura, C.sun].forEach((color, index) => {
			const local = time - (M.celebrate + 0.1 + index * 0.2);
			if (local < 0) {
				return;
			}
			P.draw(
				context,
				A.balloon(color),
				[130, 700, 290, 560][index] + Math.sin(local * 1.6 + index) * 26,
				1350 - local * (260 + index * 30),
				{ scale: 0.7, rotation: Math.sin(local * 1.8 + index) * 0.08, time },
			);
		});
		P.puppet(
			context,
			'jana',
			420,
			1110,
			{
				expression: 'happyClosed',
				headTilt: Math.sin(time * 5) * 0.06,
				bob: bounce(time) * 16,
				leftHand: [-200, -300],
				rightHand: [200, -300],
				headProp: (headContext) =>
					P.draw(headContext, A.headphones(), 0, -38, {
						scale: 1.02,
						time,
						shadowAlpha: 0.2,
					}),
			},
			{ scale: 1.08, time },
		);

		/* the list: received, tucked away, ready again */
		const board = popOptions(time, M.party + 0.2, { rotation: 0.015 });
		if (board) {
			P.draw(context, listBoard(), boardCenter[0], boardCenter[1], board);
		}
		const pocketRise = settle(time, M.tuck - 0.4, 2.2, 6.5);
		const pocketOffset = (1 - pocketRise) * 420;
		const flapClose = ramp(time, M.flap, 0.3, E.inOutCubic);
		const flapScale = 1 - flapClose * 2;
		const drawFlap = () =>
			P.draw(context, A.pocketFlap(), pocketHinge[0], pocketHinge[1] + pocketOffset, {
				scaleY: flapScale,
				time,
				shadowAlpha: flapScale < 0 ? 0.3 : 0.15,
			});
		if (pocketRise > 0) {
			P.draw(context, A.pocketBack(), pocketCenter[0], pocketCenter[1] + pocketOffset, {
				time,
			});
			if (flapScale > 0) {
				drawFlap();
			}
		}
		boardSlots.forEach(([slotX, slotY, rotation], index) => {
			const pop = popOptions(time, M.party + 0.35 + index * 0.08, { rotation });
			if (!pop) {
				return;
			}
			const tuck = ramp(time, M.tuck + index * 0.2, 0.35, E.inOutCubic);
			if (tuck >= 1 && flapClose >= 1) {
				return;
			}
			const [offsetX, fanRotation] = pocketFan[index];
			const [x, y] = arcPath([slotX, slotY], [pocketCenter[0] + offsetX, 850], 140, tuck);
			drawCard(context, cardItems[index], x, y + (tuck >= 1 ? pocketOffset : 0), {
				scale: pop.scale * P.lerp(0.55, 0.42, tuck),
				rotation: P.lerp(pop.rotation, fanRotation, tuck),
				time,
				lift: tuck > 0 && tuck < 1 ? 0.6 : pop.lift,
				checked: time - (M.received + index * 0.25),
			});
		});
		if (pocketRise > 0) {
			P.draw(
				context,
				A.pocketFront('Received'),
				pocketCenter[0],
				pocketCenter[1] + pocketOffset,
				{ time },
			);
			if (flapScale <= 0) {
				drawFlap();
			}
		}
		boardSlots.forEach(([slotX, slotY, rotation], index) =>
			drawPop(context, A.emptySlot(), slotX, slotY, time, M.nextTime + index * 0.2, {
				scale: 0.55,
				rotation,
			}),
		);
		sparkleBurst(context, time, M.nextTime + 0.3, boardCenter[0], boardCenter[1], {
			count: 8,
			radius: 520,
			seed: 121,
		});
		confetti(context, time, M.celebrate, {
			originX: 420,
			originY: 700,
			count: 90,
			seed: 5,
			power: 1.1,
		});
		confetti(context, time, M.celebrate + 0.25, {
			originX: 160,
			originY: 1100,
			count: 40,
			seed: 8,
			spread: 0.5,
			power: 1.1,
		});
		confetti(context, time, M.celebrate + 0.35, {
			originX: 1760,
			originY: 1100,
			count: 40,
			seed: 9,
			spread: 0.5,
			power: 1.1,
		});
	};

	/* ---------- scene 12: free, no ads, the name ---------- */
	const shootingStarPath = S.bezier(
		[
			[120, 420],
			[640, 170],
			[1260, 120],
			[1840, 300],
		],
		40,
	);
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
					{
						spacing: 8,
						amplitude: 4,
					},
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

		/* free and ad-free, then both tuck into the top corners */
		const corner = ramp(time, M.toCorners, 0.5, E.inOutCubic);
		if (time >= M.free) {
			const local = time - M.free;
			const slam =
				local < 0.12
					? P.lerp(2.4, 1, E.inQuad(local / 0.12))
					: 1 - (1 - P.spring(local - 0.12, 3, 7)) * 0.1;
			P.draw(
				context,
				A.badge(['free', '€0'], C.sky),
				P.lerp(700, 200, corner),
				P.lerp(520, 190, corner),
				{
					scale: slam * P.lerp(1.15, 0.5, corner),
					rotation: -0.12 + Math.sin(time * 1.5) * 0.02,
					lift: P.clamp(1 - local / 0.12),
					time,
				},
			);
		}
		if (time >= M.noAds) {
			const pop = popOptions(time, M.noAds, { rotation: 0.06 });
			const x = P.lerp(1220, 1720, corner);
			const y = P.lerp(520, 200, corner);
			const scale = P.lerp(1, 0.45, corner);
			P.draw(context, A.adSign(), x, y, { ...pop, scale: pop.scale * scale });
			const slash = ramp(time, M.noAdsSlash, 0.4, E.outQuad);
			context.save();
			context.translate(x, y);
			context.scale(scale, scale);
			P.drawOn(
				context,
				S.ellipse(0, 0, 200, 200, 48, -1.2).concat([[40, -196]]),
				slash * 1.5,
				{
					width: 12,
					color: C.coral,
					seed: 131,
				},
			);
			P.drawOn(
				context,
				[
					[-140, 140],
					[140, -140],
				],
				slash * 3 - 2,
				{ width: 12, color: C.coral, seed: 132 },
			);
			context.restore();
		}

		/* a shooting star for every wish */
		if (between(time, M.shootingStar, M.shootingStar + 1.6)) {
			const travel = ramp(time, M.shootingStar, 0.9, E.inOutSine);
			const head = pathPoint(shootingStarPath, travel);
			const tail = [];
			for (let step = 0; step <= 14; step++) {
				tail.push(pathPoint(shootingStarPath, Math.max(0, travel - step * 0.018)));
			}
			const fade = 1 - ramp(time, M.shootingStar + 0.9, 0.5);
			context.save();
			context.globalAlpha = fade * 0.85;
			P.tracePath(
				context,
				S.ribbon(tail, (fraction) => (1 - fraction) * 16 + 1),
			);
			context.fillStyle = P.paperFill(context, C.sunPale);
			context.fill();
			context.restore();
			for (let index = 0; index < 5; index++) {
				const [x, y] = tail[Math.min(tail.length - 1, 3 + index * 2)];
				P.draw(
					context,
					A.sparkle([C.sun, C.white, C.bright][index % 3], 22),
					x,
					y + Math.sin(time * 9 + index) * 10,
					{
						scale: fade * (1 - index * 0.15),
						rotation: time * 3 + index,
						time,
						shadowAlpha: 0.1,
					},
				);
			}
			if (travel < 1) {
				P.draw(context, A.sparkle(C.sun, 60), head[0], head[1], {
					scale: 1.1,
					rotation: time * 4,
					time,
					lift: 0.6,
				});
			}
		}
		sparkleBurst(context, time, M.shootingStar + 0.85, 1840, 300, {
			count: 8,
			radius: 260,
			seed: 133,
		});

		const corners = [
			[() => A.teddy(), 190, 880, -0.12, 0.5],
			[() => A.headphones(), 1730, 900, 0.18, 0.55],
			[() => A.heart(C.sakura, 60), 1480, 160, 0.2, 0.8],
			[() => A.balloon(C.mint), 440, 190, 0.1, 0.42],
			[() => A.plant(), 440, 930, 0.08, 0.38],
			[() => A.giftBody(C.sky, C.sun, 'dots'), 1500, 950, -0.1, 0.5],
		];
		corners.forEach(([make, x, y, rotation, scale], index) =>
			drawPop(
				context,
				make(),
				x,
				y + Math.sin(time * 1.8 + index * 1.3) * 8,
				time,
				M.endStickers + index * 0.12,
				{
					scale,
					rotation: rotation + Math.sin(time * 1.2 + index) * 0.03,
				},
			),
		);
		drawWordmark(context, time, M.endLogo, {
			x: W / 2,
			y: 470,
			withTld: true,
			scale: 0.92,
			lettersDelay: M.endLetters - M.endLogo,
			tldDelay: M.dotCz - M.endLogo,
		});
		P.handText(context, 'Share your wishes. Keep the surprise.', W / 2, 720, {
			size: 86,
			align: 'center',
			reveal: ramp(time, M.tagline, 1.3, E.linear),
			time,
			color: C.deep,
		});
		if (time >= M.button) {
			P.drawOn(
				context,
				S.bezier(
					[
						[600, 762],
						[880, 792],
						[1140, 772],
						[1330, 748],
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
			M = {
				...marks,
				askGrandma: marks.grandmaAsk,
				askFriend: marks.friendAsk,
				askAunt: marks.auntAsk,
			};
		},
		draw: (context, time) => {
			if (time < M.lidPop) {
				drawRoomScene(context, time);
			} else if (time < M.lidPop + 0.7) {
				drawRoomScene(context, time);
				drawIris(context, time);
			} else if (time < M.listScene) {
				drawLogoScene(context, time);
			} else if (time < M.listScene + 0.42) {
				slideOver(context, time, M.listScene, drawLogoScene, drawListScene, [0, 1]);
			} else if (time < M.wishScene) {
				drawListScene(context, time);
			} else if (time < M.wishScene + 0.42) {
				slideOver(context, time, M.wishScene, drawListScene, drawWishScene, [1, 0]);
			} else if (time < M.fold) {
				drawWishScene(context, time);
			} else if (time < M.cards) {
				drawShareScene(context, time);
			} else if (time < M.cards + 0.42) {
				slideOver(context, time, M.cards, drawShareScene, drawReserveScene, [0, 1]);
			} else if (time < M.heartScene) {
				drawReserveScene(context, time);
			} else if (time < M.heartScene + 0.42) {
				slideOver(context, time, M.heartScene, drawReserveScene, drawHeartScene, [1, 0]);
			} else if (time < M.secretScene) {
				drawHeartScene(context, time);
			} else if (time < M.secretScene + 0.42) {
				slideOver(context, time, M.secretScene, drawHeartScene, drawSecretScene, [1, 0]);
			} else if (time < M.rosieScene) {
				drawSecretScene(context, time);
			} else if (time < M.rosieScene + 0.42) {
				slideOver(context, time, M.rosieScene, drawSecretScene, drawNurseryScene, [0, -1]);
			} else if (time < M.party) {
				drawNurseryScene(context, time);
			} else if (time < M.party + 0.42) {
				slideOver(context, time, M.party, drawNurseryScene, drawPartyScene, [0, 1]);
			} else if (time < M.endSheet) {
				drawPartyScene(context, time);
			} else {
				if (time < M.endSheet + 0.45) {
					drawPartyScene(context, time);
				}
				drawEndScene(context, time);
			}
		},
	});
})();
