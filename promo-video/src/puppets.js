/*
 * Cut-paper puppets. Body parts are cached sprites without borders; the assembled puppet is
 * composited through a live sticker pass so the whole figure gets one white cut edge and shadow.
 */
(() => {
	const P = window.P;
	const C = P.C;
	const S = P.shape;
	const { part, line } = P.art;

	P.cast = {
		jana: {
			skin: C.skin,
			hair: C.hairBrown,
			hairStyle: 'bob',
			top: C.sky,
			topDark: C.deep,
			collar: C.white,
		},
		grandma: {
			skin: '#f3c9a8',
			hair: C.hairGrey,
			hairStyle: 'bun',
			top: C.sakura,
			topDark: '#c9468a',
			collar: C.white,
			glasses: true,
		},
		friend: {
			skin: '#d9a17a',
			hair: C.hairDark,
			hairStyle: 'short',
			top: C.mint,
			topDark: '#0e8058',
			collar: C.mintPale,
		},
		aunt: {
			skin: C.skin,
			hair: C.hairGinger,
			hairStyle: 'curly',
			top: '#efa00b',
			topDark: '#c98200',
			collar: C.white,
		},
		rosie: {
			skin: '#f9d6b8',
			hair: '#8a5234',
			hairStyle: 'pigtails',
			top: C.coral,
			topDark: '#d4543a',
			collar: C.white,
		},
	};

	const UPPER = 118;
	const LOWER = 112;
	const SHOULDER_X = 118;
	const SHOULDER_Y = -218;
	const NECK_Y = -262;
	const HEAD_Y = -372;

	const torso = (look) =>
		P.sprite(
			`torso-${look.top}`,
			360,
			300,
			(context) => {
				const body = S.bezier([
					[-120, -120],
					[-150, -110],
					[-170, 60],
					[-160, 140],
					[-60, 150],
					[60, 150],
					[160, 140],
					[170, 60],
					[150, -110],
					[120, -120],
					[40, -130],
					[-40, -130],
					[-120, -120],
				]);
				const outline = part(context, body, look.top, { seed: 501 });
				P.hatch(context, outline, {
					region: S.rect(60, -140, 140, 300),
					alpha: 0.13,
					seed: 502,
				});
				for (let x = -130; x <= 130; x += 26) {
					line(
						context,
						[
							[x, 118],
							[x, 146],
						],
						{ seed: 503 + x, width: 2, alpha: 0.35, color: look.topDark },
					);
				}
				part(
					context,
					S.bezier(
						[
							[-58, -128],
							[-40, -84],
							[40, -84],
							[58, -128],
						],
						12,
					).concat([[0, -124]]),
					look.collar,
					{ seed: 504, line: 2.4, cut: false },
				);
			},
			{ border: 0 },
		);

	const neck = (look) =>
		P.sprite(
			`neck-${look.skin}`,
			90,
			90,
			(context) => {
				part(context, S.rect(-30, -40, 60, 80), look.skin, { seed: 511, line: 2.4 });
				P.hatch(context, S.rect(-30, -40, 60, 80), {
					region: S.rect(-40, -44, 90, 36),
					alpha: 0.18,
				});
			},
			{ border: 0 },
		);

	const upperArm = (look) =>
		P.sprite(
			`upper-${look.top}`,
			80,
			UPPER + 140,
			(context) => {
				const arm = part(
					context,
					S.roundRect(-30, -UPPER / 2 - 30, 60, UPPER + 60, 30),
					look.top,
					{ seed: 521 },
				);
				P.hatch(context, arm, { region: S.rect(8, -200, 40, 400), alpha: 0.13 });
			},
			{ border: 0 },
		);

	/* Forearm ends in a mitten hand; `grip` bakes a closed fist for holding things. */
	const forearm = (look, grip = false) =>
		P.sprite(
			`forearm-${look.top}-${grip}`,
			90,
			LOWER + 140,
			(context) => {
				context.translate(0, -LOWER / 2);
				part(context, S.ellipse(0, LOWER + 4, 33, 34, 24), look.skin, {
					seed: 531,
					line: 2.6,
				});
				if (!grip) {
					part(context, S.ellipse(-26, LOWER - 10, 11, 20, 14, 0.5), look.skin, {
						seed: 532,
						line: 2.4,
					});
				} else {
					line(
						context,
						[
							[-18, LOWER + 2],
							[10, LOWER - 6],
						],
						{ seed: 533, width: 2.4, alpha: 0.6 },
					);
				}
				const sleeve = part(context, S.roundRect(-29, -30, 58, LOWER + 4, 28), look.top, {
					seed: 534,
				});
				P.hatch(context, sleeve, { region: S.rect(8, -60, 40, 300), alpha: 0.13 });
				part(context, S.rect(-31, LOWER - 34, 62, 18), look.topDark, {
					seed: 535,
					line: 2,
				});
			},
			{ border: 0 },
		);

	const hairBack = (look) =>
		P.sprite(
			`hair-back-${look.hairStyle}-${look.hair}`,
			330,
			340,
			(context) => {
				if (look.hairStyle === 'bob') {
					part(
						context,
						S.bezier(
							[
								[0, -150],
								[-170, -150],
								[-170, 60],
								[-150, 120],
								[-80, 130],
								[80, 130],
								[150, 120],
								[170, 60],
								[170, -150],
								[0, -150],
							],
							16,
						),
						look.hair,
						{ seed: 541 },
					);
				}
				if (look.hairStyle === 'bun') {
					part(context, S.ellipse(0, -150, 60, 52, 32), look.hair, { seed: 542 });
				}
				if (look.hairStyle === 'pigtails') {
					part(context, S.ellipse(0, -40, 138, 128, 40), look.hair, { seed: 545 });
					for (const side of [-1, 1]) {
						const bunch = part(
							context,
							S.ellipse(side * 138, 30, 36, 62, 28, side * -0.35),
							look.hair,
							{ seed: 546 + side },
						);
						P.hatch(context, bunch, { alpha: 0.12, seed: 548 + side });
						part(context, S.ellipse(side * 122, -22, 20, 16, 16), C.sakura, {
							seed: 549 + side,
							line: 2.2,
						});
					}
				}
				if (look.hairStyle === 'curly') {
					const points = [];
					for (let index = 0; index < 80; index++) {
						const angle = (index / 80) * Math.PI * 2;
						const radius = 150 + Math.abs(Math.sin(angle * 7)) * 22;
						points.push([
							Math.cos(angle) * radius,
							Math.sin(angle) * radius * 0.92 + 10,
						]);
					}
					const outline = part(context, points, look.hair, { seed: 543, cut: false });
					for (let index = 0; index < 14; index++) {
						const angle = (index / 14) * Math.PI * 2;
						P.pencil(
							context,
							S.ellipse(
								Math.cos(angle) * 118,
								Math.sin(angle) * 110 + 10,
								16,
								16,
								12,
							).slice(0, 8),
							{ seed: 544 + index, width: 2.2, alpha: 0.45 },
						);
					}
					P.hatch(context, outline, { alpha: 0.1 });
				}
			},
			{ border: 0 },
		);

	const head = (look) =>
		P.sprite(
			`head-${look.skin}-${look.hairStyle}-${look.hair}`,
			330,
			320,
			(context) => {
				for (const side of [-1, 1]) {
					part(context, S.ellipse(side * 112, 14, 22, 30, 20), look.skin, {
						seed: 551 + side,
						line: 2.6,
					});
				}
				const face = part(context, S.ellipse(0, 0, 118, 124, 56), look.skin, { seed: 553 });
				P.hatch(context, face, {
					region: S.ellipse(90, 80, 90, 100),
					alpha: 0.1,
					seed: 554,
				});
				P.crayon(context, S.ellipse(-66, 44, 26, 17, 18), C.cheek, 0.55);
				P.crayon(context, S.ellipse(66, 44, 26, 17, 18), C.cheek, 0.55);
				line(
					context,
					S.bezier(
						[
							[4, 6],
							[-6, 30],
							[-8, 36],
							[6, 38],
						],
						10,
					),
					{ seed: 555, width: 2.8, alpha: 0.7 },
				);
				if (look.hairStyle === 'pigtails') {
					part(
						context,
						S.bezier(
							[
								[-124, 0],
								[-136, -112],
								[-50, -142],
								[10, -136],
								[90, -142],
								[140, -96],
								[124, 0],
								[104, -52],
								[70, -58],
								[40, -76],
								[10, -60],
								[-20, -78],
								[-60, -58],
								[-104, -48],
								[-124, 0],
							],
							16,
						),
						look.hair,
						{ seed: 564 },
					);
					line(
						context,
						[
							[0, -132],
							[4, -96],
						],
						{ seed: 565, width: 2, alpha: 0.4 },
					);
				}
				if (look.hairStyle === 'bob') {
					part(
						context,
						S.bezier(
							[
								[-126, 10],
								[-140, -110],
								[-60, -140],
								[10, -132],
								[80, -140],
								[140, -100],
								[126, 10],
								[110, -40],
								[60, -64],
								[20, -70],
								[-30, -70],
								[-100, -40],
								[-126, 10],
							],
							16,
						),
						look.hair,
						{ seed: 556 },
					);
				}
				if (look.hairStyle === 'bun') {
					part(
						context,
						S.bezier(
							[
								[-120, -10],
								[-130, -120],
								[-40, -134],
								[0, -128],
								[40, -134],
								[130, -120],
								[120, -10],
								[100, -60],
								[40, -86],
								[0, -84],
								[-40, -86],
								[-100, -60],
								[-120, -10],
							],
							16,
						),
						look.hair,
						{ seed: 557 },
					);
					for (let index = -2; index <= 2; index++) {
						line(
							context,
							S.bezier(
								[
									[index * 30, -120],
									[index * 34, -104],
									[index * 40, -90],
									[index * 46, -82],
								],
								6,
							),
							{ seed: 558 + index, width: 1.8, alpha: 0.35 },
						);
					}
				}
				if (look.hairStyle === 'short') {
					part(
						context,
						S.bezier(
							[
								[-122, -4],
								[-136, -130],
								[-20, -160],
								[40, -144],
								[150, -130],
								[130, -30],
								[122, -4],
								[108, -60],
								[60, -84],
								[0, -96],
								[-50, -84],
								[-104, -64],
								[-122, -4],
							],
							16,
						),
						look.hair,
						{ seed: 559 },
					);
				}
				if (look.hairStyle === 'curly') {
					const fringe = [];
					for (let index = 0; index <= 40; index++) {
						const amount = index / 40;
						const angle = Math.PI * (1.05 + amount * 0.9);
						const radius = 128 + Math.abs(Math.sin(amount * Math.PI * 5)) * 18;
						fringe.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
					}
					for (let index = 40; index >= 0; index--) {
						const amount = index / 40;
						const angle = Math.PI * (1.05 + amount * 0.9);
						fringe.push([
							Math.cos(angle) * 86,
							Math.sin(angle) * 80 -
								12 +
								Math.abs(Math.sin(amount * Math.PI * 4)) * 14,
						]);
					}
					part(context, fringe, look.hair, { seed: 560, cut: false });
				}
				if (look.glasses) {
					for (const side of [-1, 1]) {
						P.pencil(context, S.ellipse(side * 44, 0, 32, 28, 24), {
							closed: true,
							seed: 561 + side,
							width: 4.5,
							color: C.ink,
							alpha: 0.9,
							gaps: false,
						});
					}
				}
				if (look.glasses) {
					line(
						context,
						[
							[-12, -4],
							[12, -4],
						],
						{ seed: 563, width: 4 },
					);
				}
			},
			{ border: 0 },
		);

	/* Two-bone IK: elbow bends toward `bend` (+1 = clockwise from shoulder->hand). */
	const solveArm = (shoulderX, shoulderY, handX, handY, bend) => {
		const dx = handX - shoulderX;
		const dy = handY - shoulderY;
		const distance = P.clamp(
			Math.hypot(dx, dy),
			Math.abs(UPPER - LOWER) + 2,
			UPPER + LOWER - 1,
		);
		const toHand = Math.atan2(dy, dx);
		const shoulderAngle =
			toHand -
			bend *
				Math.acos(
					(UPPER * UPPER + distance * distance - LOWER * LOWER) / (2 * UPPER * distance),
				);
		const elbowX = shoulderX + Math.cos(shoulderAngle) * UPPER;
		const elbowY = shoulderY + Math.sin(shoulderAngle) * UPPER;
		const forearmAngle = Math.atan2(shoulderY + dy - elbowY, shoulderX + dx - elbowX);
		return { shoulderAngle, elbowX, elbowY, forearmAngle };
	};
	/* Elbows read naturally when they bend away from the body's centerline. */
	const solveArmOutward = (shoulderX, shoulderY, handX, handY) => {
		const first = solveArm(shoulderX, shoulderY, handX, handY, 1);
		const second = solveArm(shoulderX, shoulderY, handX, handY, -1);
		return Math.sign(shoulderX) * first.elbowX > Math.sign(shoulderX) * second.elbowX
			? first
			: second;
	};

	const drawLimb = (context, sprite, x, y, angle, length, time) => {
		P.draw(context, sprite, x, y, {
			rotation: angle - Math.PI / 2,
			anchorY: 0.5 - length / 2 / sprite.height,
			time,
			shadowAlpha: 0,
		});
	};

	/*
	 * Draws facial features live so expressions can change per frame.
	 * expression: smile | grin | forced | oh | worried | happyClosed | shh
	 */
	const drawFace = (context, pose, time) => {
		const { expression = 'smile', look = 0, blink = 0 } = pose;
		const variantSeed = P.boilFrame(time);
		const eyeY = -6;
		const lookX = look * 12;
		context.save();
		const brow =
			{ smile: -4, grin: -8, forced: 4, oh: -14, worried: 6, happyClosed: -8, shh: -6 }[
				expression
			] ?? 0;
		for (const side of [-1, 1]) {
			const tilt = expression === 'worried' || expression === 'forced' ? side * -6 : 0;
			P.pencil(
				context,
				[
					[side * 44 - 20, eyeY - 34 + brow + tilt],
					[side * 44, eyeY - 40 + brow],
					[side * 44 + 20, eyeY - 34 + brow - tilt],
				],
				{ seed: 600 + side + variantSeed, width: 5, alpha: 0.85, gaps: false, passes: 1 },
			);
			if (expression === 'happyClosed' || blink > 0.5) {
				P.pencil(
					context,
					S.bezier(
						[
							[side * 44 - 16 + lookX, eyeY + 4],
							[side * 44 - 8 + lookX, eyeY - 10],
							[side * 44 + 8 + lookX, eyeY - 10],
							[side * 44 + 16 + lookX, eyeY + 4],
						],
						8,
					),
					{
						seed: 610 + side + variantSeed,
						width: 5.5,
						alpha: 0.95,
						gaps: false,
						passes: 1,
					},
				);
			} else {
				const eyeHeight = expression === 'oh' ? 20 : 16;
				P.tracePath(
					context,
					S.ellipse(side * 44 + lookX, eyeY, 12, eyeHeight * (1 - blink), 18),
				);
				context.fillStyle = C.ink;
				context.fill();
				P.tracePath(context, S.ellipse(side * 44 + lookX + 4, eyeY - 6, 4, 4.5, 10));
				context.fillStyle = C.white;
				context.fill();
			}
		}
		const mouthY = 62;
		const pencilOptions = {
			seed: 620 + variantSeed,
			width: 5,
			alpha: 0.95,
			gaps: false,
			passes: 1,
		};
		if (expression === 'smile') {
			P.pencil(
				context,
				S.bezier(
					[
						[-30, mouthY - 4],
						[-16, mouthY + 16],
						[16, mouthY + 16],
						[30, mouthY - 4],
					],
					14,
				),
				pencilOptions,
			);
		}
		if (expression === 'forced') {
			P.pencil(
				context,
				[
					[-36, mouthY],
					[-22, mouthY + 6],
					[-8, mouthY],
					[6, mouthY + 6],
					[20, mouthY],
					[36, mouthY + 4],
				],
				pencilOptions,
			);
			P.tracePath(
				context,
				S.heart(96, -78, 12).map(([x, y]) => [x, y]),
			);
			const drop = S.bezier(
				[
					[98, -110],
					[86, -84],
					[84, -70],
					[98, -68],
					[112, -70],
					[110, -84],
					[98, -110],
				],
				8,
			);
			P.tracePath(context, drop);
			context.fillStyle = C.skyPale;
			context.fill();
			P.pencil(context, drop, { ...pencilOptions, width: 2.6, closed: true });
		}
		if (expression === 'grin' || expression === 'happyClosed') {
			const mouth = S.bezier(
				[
					[-42, mouthY - 8],
					[-30, mouthY + 44],
					[30, mouthY + 44],
					[42, mouthY - 8],
				],
				16,
			);
			P.tracePath(context, mouth);
			context.fillStyle = '#7a2e3a';
			context.fill();
			context.save();
			context.clip();
			P.tracePath(context, S.ellipse(0, mouthY + 34, 22, 14, 16));
			context.fillStyle = C.coral;
			context.fill();
			context.fillStyle = C.white;
			context.fillRect(-40, mouthY - 12, 80, 12);
			context.restore();
			P.pencil(context, mouth, { ...pencilOptions, closed: true, width: 4 });
		}
		if (expression === 'oh') {
			const mouth = S.ellipse(0, mouthY + 6, 14, 18, 16);
			P.tracePath(context, mouth);
			context.fillStyle = '#7a2e3a';
			context.fill();
			P.pencil(context, mouth, { ...pencilOptions, closed: true, width: 4 });
		}
		if (expression === 'worried') {
			P.pencil(
				context,
				S.bezier(
					[
						[-24, mouthY + 10],
						[-10, mouthY - 2],
						[10, mouthY - 2],
						[24, mouthY + 10],
					],
					12,
				),
				pencilOptions,
			);
		}
		if (expression === 'shh') {
			P.tracePath(context, S.ellipse(0, mouthY + 4, 12, 9, 12));
			context.fillStyle = '#7a2e3a';
			context.fill();
		}
		context.restore();
	};

	const layers = new Map();
	const layerFor = (key, width, height) => {
		let layer = layers.get(key);
		if (!layer) {
			layer = {
				art: P.canvas(width, height),
				border: P.canvas(width, height),
				shadow: P.canvas(width, height),
			};
			layers.set(key, layer);
		}
		for (const canvas of [layer.art, layer.border, layer.shadow]) {
			canvas.getContext('2d').clearRect(0, 0, width, height);
		}
		return layer;
	};

	/*
	 * Live sticker pass for any compound drawing. `draw` renders around origin (0,0) = bottom center;
	 * the box extends `width` wide and `height` up from it, plus `below` px underneath.
	 */
	P.stickerLayer = (
		context,
		key,
		x,
		y,
		{
			width,
			height,
			below = 60,
			scale = 1,
			rotation = 0,
			alpha = 1,
			lift = 0,
			border = 9,
			draw,
		},
	) => {
		const pad = border + 30;
		const canvasWidth = width + pad * 2;
		const canvasHeight = height + below + pad * 2;
		const layer = layerFor(key, canvasWidth, canvasHeight);
		const artContext = layer.art.getContext('2d');
		artContext.save();
		artContext.translate(canvasWidth / 2, pad + height);
		draw(artContext);
		artContext.restore();
		const borderContext = layer.border.getContext('2d');
		for (let step = 0; step < 16; step++) {
			const angle = (step / 16) * Math.PI * 2;
			borderContext.drawImage(layer.art, Math.cos(angle) * border, Math.sin(angle) * border);
		}
		borderContext.globalCompositeOperation = 'source-in';
		borderContext.fillStyle = P.paperFill(borderContext, C.paper);
		borderContext.fillRect(0, 0, canvasWidth, canvasHeight);
		borderContext.globalCompositeOperation = 'source-over';
		borderContext.drawImage(layer.art, 0, 0);
		const shadowContext = layer.shadow.getContext('2d');
		shadowContext.filter = 'blur(6px)';
		shadowContext.drawImage(layer.border, 0, 0);
		shadowContext.filter = 'none';
		shadowContext.globalCompositeOperation = 'source-in';
		shadowContext.fillStyle = 'rgb(22,40,70)';
		shadowContext.fillRect(0, 0, canvasWidth, canvasHeight);
		shadowContext.globalCompositeOperation = 'source-over';
		const offsetX = -canvasWidth / 2;
		const offsetY = -(pad + height);
		const shadowDistance = 6 + lift * 22;
		context.save();
		context.globalAlpha = alpha * 0.32;
		context.translate(x + shadowDistance * 0.7 * scale, y + shadowDistance * scale);
		context.rotate(rotation);
		context.scale(scale, scale);
		context.drawImage(layer.shadow, offsetX, offsetY);
		context.restore();
		context.save();
		context.globalAlpha = alpha;
		context.translate(x, y);
		context.rotate(rotation);
		context.scale(scale * (1 + lift * 0.04), scale * (1 + lift * 0.04));
		context.drawImage(layer.border, offsetX, offsetY);
		context.restore();
	};

	/*
	 * pose: { bob, lean, headTilt, headScale (children read younger with a larger head), expression, look, blink,
	 *         leftHand:[x,y], rightHand:[x,y] (relative to hips), leftGrip, rightGrip,
	 *         prop: (context, hands) => draw held props in front, headProp }
	 */
	P.puppet = (
		context,
		name,
		x,
		y,
		pose = {},
		{ scale = 1, rotation = 0, alpha = 1, lift = 0, time = 0 } = {},
	) => {
		const look = P.cast[name];
		const { bob = 0, lean = 0, headTilt = 0, headScale = 1 } = pose;
		const leftHand = pose.leftHand ?? [-176, -14];
		const rightHand = pose.rightHand ?? [176, -14];
		P.stickerLayer(context, `puppet-${name}`, x, y, {
			width: 760,
			height: 720,
			below: 120,
			scale,
			rotation: rotation + lean,
			alpha,
			lift,
			draw: (layerContext) => {
				layerContext.translate(0, bob);
				const headX = Math.sin(headTilt) * 20;
				const drawArm = (side, hand, grip) => {
					const shoulderX = side * SHOULDER_X;
					const solved = solveArmOutward(shoulderX, SHOULDER_Y, hand[0], hand[1]);
					drawLimb(
						layerContext,
						upperArm(look),
						shoulderX,
						SHOULDER_Y,
						solved.shoulderAngle,
						UPPER,
						time,
					);
					drawLimb(
						layerContext,
						forearm(look, grip),
						solved.elbowX,
						solved.elbowY,
						solved.forearmAngle,
						LOWER,
						time,
					);
					P.tracePath(layerContext, S.ellipse(solved.elbowX, solved.elbowY, 5, 5, 10));
					layerContext.fillStyle = '#c7b27a';
					layerContext.fill();
				};
				const armsInFront = pose.armsInFront ?? true;
				if (!armsInFront) {
					drawArm(-1, leftHand, pose.leftGrip);
					drawArm(1, rightHand, pose.rightGrip);
				}
				P.draw(layerContext, neck(look), headX * 0.3, NECK_Y + 10, {
					time,
					shadowAlpha: 0,
				});
				P.draw(layerContext, torso(look), 0, -115, { time, shadowAlpha: 0 });
				layerContext.save();
				layerContext.translate(headX, HEAD_Y + 110);
				layerContext.rotate(headTilt);
				layerContext.scale(headScale, headScale);
				layerContext.translate(0, -110);
				P.draw(layerContext, hairBack(look), 0, 12, { time, shadowAlpha: 0 });
				P.draw(layerContext, head(look), 0, 0, { time, shadowAlpha: 0 });
				drawFace(layerContext, pose, time);
				if (pose.headProp) {
					pose.headProp(layerContext);
				}
				layerContext.restore();
				if (armsInFront) {
					drawArm(-1, leftHand, pose.leftGrip);
					drawArm(1, rightHand, pose.rightGrip);
				}
				if (pose.prop) {
					pose.prop(layerContext, { leftHand, rightHand });
				}
			},
		});
	};

	/* An arm reaching in from outside the frame, holding something at the hand. */
	P.reachingArm = (
		context,
		name,
		handX,
		handY,
		angle,
		{ time = 0, grip = true, hold = null, scale = 0.8 } = {},
	) => {
		const look = P.cast[name];
		const sprite = P.sprite(`reach-${look.top}-${grip}`, 150, 960, (spriteContext) => {
			const sleeve = part(spriteContext, S.roundRect(-58, -440, 116, 800, 56), look.top, {
				seed: 701,
			});
			P.hatch(spriteContext, sleeve, { region: S.rect(20, -460, 60, 900), alpha: 0.13 });
			part(spriteContext, S.rect(-62, 330, 124, 40), look.topDark, { seed: 702, line: 2.4 });
			part(spriteContext, S.ellipse(0, 400, 64, 60, 30), look.skin, { seed: 703, line: 3 });
			if (!grip) {
				part(spriteContext, S.ellipse(-52, 380, 20, 36, 16, 0.5), look.skin, {
					seed: 704,
					line: 2.6,
				});
			}
			for (const offset of [-24, 0, 24]) {
				line(
					spriteContext,
					[
						[offset, 430],
						[offset + 4, 452],
					],
					{ seed: 705 + offset, width: 2.2, alpha: 0.5 },
				);
			}
		});
		context.save();
		context.translate(handX, handY);
		context.rotate(angle);
		if (hold) {
			hold(context);
		}
		P.draw(context, sprite, 0, 0, {
			anchorY: 0.5 + 400 / sprite.height,
			time,
			scale,
		});
		context.restore();
	};
})();
