import { memo, useEffect, useId, useState } from 'react';
import type { ExerciseDefinition, MuscleGroup } from './types';
import { mapExerciseMuscles } from './muscles';

type Point = [number, number];
type Pair = [Point, Point];
type Frame = {
  layout: 'standing' | 'horizontal' | 'quadruped' | 'side';
  head: Point;
  shoulder: Point;
  hip: Point;
  arms: [Pair, Pair]; // elbow, hand
  legs: [Pair, Pair]; // knee, foot
  floorY: number;
  barY?: number;
  raisedShoulders?: boolean;
  footStyle?: 'flat' | 'toes-up' | 'heels-up';
};
type Equipment = 'barbell' | 'trapbar' | 'tbar' | 'landmine' | 'dumbbells' | 'bench' | 'incline-bench' | 'cable' | 'machine' | 'pullup-bar' | 'box' | 'band' | 'kettlebell' | 'ball' | 'roller' | 'none';
type SceneKey =
  | 'back-squat' | 'front-squat' | 'hinge' | 'romanian-deadlift' | 'deadlift' | 'trap-deadlift' | 'split-squat' | 'nordic' | 'hip-thrust' | 'leg-press' | 'leg-extension' | 'leg-curl' | 'calf' | 'seated-calf' | 'tibialis' | 'copenhagen'
  | 'bench-press' | 'incline-press' | 'dumbbell-press' | 'chest-fly' | 'pec-deck' | 'crossover' | 'dip' | 'landmine-press' | 'plyo-pushup'
  | 'bent-row' | 'single-arm-row' | 'tbar-row' | 'chest-supported-row' | 'seated-row' | 'pullup' | 'pulldown' | 'face-pull' | 'straight-pulldown' | 'shrug' | 'back-extension'
  | 'overhead-press' | 'lateral-raise' | 'cable-lateral-raise' | 'front-raise' | 'rear-fly' | 'upright-row' | 'push-press'
  | 'curl' | 'dumbbell-curl' | 'cable-curl' | 'incline-curl' | 'preacher-curl' | 'pushdown' | 'skullcrusher' | 'overhead-triceps'
  | 'plank' | 'side-plank' | 'leg-raise' | 'hanging-leg-raise' | 'rollout' | 'woodchop' | 'pallof' | 'russian-twist' | 'dragon-flag' | 'bicycle-crunch' | 'dead-bug' | 'bird-dog' | 'mountain-climber'
  | 'box-jump' | 'broad-jump' | 'single-hop' | 'kettlebell-swing' | 'cossack' | 'hip-90' | 'spiderman' | 'foam-roll' | 'pogo' | 'rotational-slam' | 'lateral-bound' | 'monster-walk';
type Scene = { label: string; start: Frame; finish: Frame; equipment: Equipment[]; equipmentLabel: string };

const p = (x: number, y: number): Point => [x, y];
const limb = (elbow: Point, hand: Point): Pair => [elbow, hand];
const leg = (knee: Point, foot: Point): Pair => [knee, foot];

const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const mixPoint = (from: Point, to: Point, progress: number): Point => [mix(from[0], to[0], progress), mix(from[1], to[1], progress)];
const mixPair = (from: Pair, to: Pair, progress: number): Pair => [mixPoint(from[0], to[0], progress), mixPoint(from[1], to[1], progress)];

function interpolateFrame(from: Frame, to: Frame, progress: number, movesBar: boolean): Frame {
  return {
    layout: from.layout,
    head: mixPoint(from.head, to.head, progress),
    shoulder: mixPoint(from.shoulder, to.shoulder, progress),
    hip: mixPoint(from.hip, to.hip, progress),
    arms: [mixPair(from.arms[0], to.arms[0], progress), mixPair(from.arms[1], to.arms[1], progress)],
    legs: [mixPair(from.legs[0], to.legs[0], progress), mixPair(from.legs[1], to.legs[1], progress)],
    floorY: mix(from.floorY, to.floorY, progress),
    ...(movesBar ? { barY: mix(from.barY ?? 28, to.barY ?? 28, progress) } : {}),
    footStyle: progress < .5 ? from.footStyle : to.footStyle,
  };
}
const standing = (armPose: 'rest' | 'bar' | 'front-rack' | 'overhead' | 'side-low' | 'side-high' | 'front-low' | 'front-high' | 'curl-low' | 'curl-high' | 'pushdown-high' | 'pushdown-low' | 'face-high' | 'face-pull' | 'row-low' | 'row-pull' | 'wood-high' | 'wood-low' | 'landmine-low' | 'landmine-high' | 'swing-low' | 'swing-high' | 'raised-shoulders', legPose: 'neutral' | 'squat' | 'split' | 'lunge' | 'jump' | 'cossack' | 'calf' = 'neutral', lean = 0, options: { shoulderLift?: number; hipShift?: number; footLift?: number; barY?: number } = {}): Frame => {
  const cx = 55 + lean * .28;
  const shoulderY = 33 - (options.shoulderLift ?? 0);
  const hipY = 62 + (options.hipShift ?? 0);
  const head = p(cx + lean * .08, shoulderY - 19);
  let arms: [Pair, Pair];
  switch (armPose) {
    case 'bar': arms = [limb(p(cx - 17, shoulderY - 3), p(cx - 29, shoulderY - 8)), limb(p(cx + 17, shoulderY - 3), p(cx + 29, shoulderY - 8))]; break;
    case 'front-rack': arms = [limb(p(cx - 17, shoulderY - 8), p(cx - 5, shoulderY - 2)), limb(p(cx + 17, shoulderY - 8), p(cx + 5, shoulderY - 2))]; break;
    case 'overhead': arms = [limb(p(cx - 16, shoulderY - 17), p(cx - 17, shoulderY - 32)), limb(p(cx + 16, shoulderY - 17), p(cx + 17, shoulderY - 32))]; break;
    case 'side-low': arms = [limb(p(cx - 12, shoulderY + 12), p(cx - 17, shoulderY + 31)), limb(p(cx + 12, shoulderY + 12), p(cx + 17, shoulderY + 31))]; break;
    case 'side-high': arms = [limb(p(cx - 20, shoulderY + 9), p(cx - 36, shoulderY + 8)), limb(p(cx + 20, shoulderY + 9), p(cx + 36, shoulderY + 8))]; break;
    case 'front-low': arms = [limb(p(cx - 8, shoulderY + 11), p(cx - 9, shoulderY + 27)), limb(p(cx + 8, shoulderY + 11), p(cx + 9, shoulderY + 27))]; break;
    case 'front-high': arms = [limb(p(cx - 12, shoulderY - 1), p(cx - 14, shoulderY - 20)), limb(p(cx + 12, shoulderY - 1), p(cx + 14, shoulderY - 20))]; break;
    case 'curl-low': arms = [limb(p(cx - 13, shoulderY + 13), p(cx - 15, shoulderY + 30)), limb(p(cx + 13, shoulderY + 13), p(cx + 15, shoulderY + 30))]; break;
    case 'curl-high': arms = [limb(p(cx - 13, shoulderY + 12), p(cx - 14, shoulderY - 2)), limb(p(cx + 13, shoulderY + 12), p(cx + 14, shoulderY - 2))]; break;
    case 'pushdown-high': arms = [limb(p(cx - 13, shoulderY + 13), p(cx - 13, shoulderY - 1)), limb(p(cx + 13, shoulderY + 13), p(cx + 13, shoulderY - 1))]; break;
    case 'pushdown-low': arms = [limb(p(cx - 13, shoulderY + 13), p(cx - 13, shoulderY + 36)), limb(p(cx + 13, shoulderY + 13), p(cx + 13, shoulderY + 36))]; break;
    case 'face-high': arms = [limb(p(cx - 20, shoulderY - 12), p(cx - 30, shoulderY - 23)), limb(p(cx + 20, shoulderY - 12), p(cx + 30, shoulderY - 23))]; break;
    case 'face-pull': arms = [limb(p(cx - 22, shoulderY - 4), p(cx - 9, shoulderY - 10)), limb(p(cx + 22, shoulderY - 4), p(cx + 9, shoulderY - 10))]; break;
    case 'row-low': arms = [limb(p(cx - 18, shoulderY + 18), p(cx - 26, shoulderY + 39)), limb(p(cx + 18, shoulderY + 18), p(cx + 26, shoulderY + 39))]; break;
    case 'row-pull': arms = [limb(p(cx - 15, shoulderY + 12), p(cx - 12, shoulderY + 31)), limb(p(cx + 15, shoulderY + 12), p(cx + 12, shoulderY + 31))]; break;
    case 'wood-high': arms = [limb(p(cx - 12, shoulderY - 8), p(cx - 5, shoulderY - 28)), limb(p(cx + 12, shoulderY - 8), p(cx + 5, shoulderY - 28))]; break;
    case 'wood-low': arms = [limb(p(cx - 15, shoulderY + 7), p(cx - 7, shoulderY + 36)), limb(p(cx + 15, shoulderY + 7), p(cx + 7, shoulderY + 36))]; break;
    case 'landmine-low': arms = [limb(p(cx - 14, shoulderY + 4), p(cx - 2, shoulderY + 13)), limb(p(cx + 14, shoulderY + 4), p(cx + 2, shoulderY + 13))]; break;
    case 'landmine-high': arms = [limb(p(cx - 16, shoulderY - 9), p(cx - 5, shoulderY - 30)), limb(p(cx + 16, shoulderY - 9), p(cx + 5, shoulderY - 30))]; break;
    case 'swing-low': arms = [limb(p(cx - 11, shoulderY + 25), p(cx - 1, shoulderY + 45)), limb(p(cx + 11, shoulderY + 25), p(cx + 1, shoulderY + 45))]; break;
    case 'swing-high': arms = [limb(p(cx - 12, shoulderY - 7), p(cx - 4, shoulderY - 19)), limb(p(cx + 12, shoulderY - 7), p(cx + 4, shoulderY - 19))]; break;
    case 'raised-shoulders': arms = [limb(p(cx - 12, shoulderY + 15), p(cx - 15, shoulderY + 32)), limb(p(cx + 12, shoulderY + 15), p(cx + 15, shoulderY + 32))]; break;
    default: arms = [limb(p(cx - 13, shoulderY + 13), p(cx - 15, shoulderY + 31)), limb(p(cx + 13, shoulderY + 13), p(cx + 15, shoulderY + 31))];
  }
  let legs: [Pair, Pair];
  switch (legPose) {
    case 'squat': legs = [leg(p(cx - 19, hipY + 10), p(cx - 28, 111)), leg(p(cx + 20, hipY + 10), p(cx + 29, 111))]; break;
    case 'split': legs = [leg(p(cx - 16, hipY + 13), p(cx - 24, 111)), leg(p(cx + 20, hipY + 18), p(cx + 39, 111))]; break;
    case 'lunge': legs = [leg(p(cx - 21, hipY + 13), p(cx - 30, 110)), leg(p(cx + 22, hipY + 18), p(cx + 40, 108))]; break;
    case 'jump': legs = [leg(p(cx - 17, hipY + 10), p(cx - 28, 100 - (options.footLift ?? 0))), leg(p(cx + 17, hipY + 10), p(cx + 28, 100 - (options.footLift ?? 0)))]; break;
    case 'cossack': legs = [leg(p(cx - 29, hipY + 10), p(cx - 45, 110)), leg(p(cx + 25, hipY + 21), p(cx + 47, 110))]; break;
    case 'calf': legs = [leg(p(cx - 10, hipY + 23), p(cx - 14, 111 - (options.footLift ?? 0))), leg(p(cx + 10, hipY + 23), p(cx + 14, 111 - (options.footLift ?? 0)))]; break;
    default: legs = [leg(p(cx - 9, hipY + 22), p(cx - 12, 111)), leg(p(cx + 9, hipY + 22), p(cx + 12, 111))];
  }
  return { layout: 'standing', head, shoulder: p(cx, shoulderY), hip: p(cx, hipY), arms, legs, floorY: 116, ...(options.barY === undefined ? {} : { barY: options.barY }), ...(armPose === 'raised-shoulders' ? { raisedShoulders: true } : {}) };
};

const squatFrame = (frontRack: boolean, lowered: boolean): Frame => {
  const shoulderY = lowered ? 45 : 33;
  const hipY = lowered ? 78 : 62;
  const cx = 55;
  const arms: [Pair, Pair] = frontRack
    ? [limb(p(cx - 17, shoulderY - 5), p(cx - 5, shoulderY + 1)), limb(p(cx + 17, shoulderY - 5), p(cx + 5, shoulderY + 1))]
    : [limb(p(cx - 17, shoulderY - 3), p(cx - 29, shoulderY - 8)), limb(p(cx + 17, shoulderY - 3), p(cx + 29, shoulderY - 8))];
  return {
    layout: 'standing', head: p(cx, shoulderY - 19), shoulder: p(cx, shoulderY), hip: p(cx, hipY), arms,
    legs: lowered
      ? [leg(p(cx - 20, hipY + 9), p(cx - 29, 111)), leg(p(cx + 20, hipY + 9), p(cx + 30, 111))]
      : [leg(p(cx - 10, hipY + 22), p(cx - 13, 111)), leg(p(cx + 10, hipY + 22), p(cx + 13, 111))],
    floorY: 116, barY: shoulderY - 4,
  };
};

const bentOverFrame = (pulled: boolean, barY?: number): Frame => ({
  layout: 'standing', head: p(48, 28), shoulder: p(54, 47), hip: p(64, 73),
  arms: pulled
    ? [limb(p(43, 57), p(52, 64)), limb(p(67, 57), p(61, 64))]
    : [limb(p(42, 62), p(38, 82)), limb(p(70, 62), p(76, 82))],
  legs: [leg(p(48, 91), p(41, 111)), leg(p(79, 92), p(87, 111))], floorY: 116,
  ...(barY === undefined ? {} : { barY }),
});

const singleArmRowFrame = (pulled: boolean): Frame => ({
  layout: 'standing', head: p(46, 30), shoulder: p(54, 48), hip: p(65, 74),
  arms: [limb(p(38, 68), p(33, 88)), pulled ? limb(p(78, 56), p(72, 65)) : limb(p(75, 67), p(81, 87))],
  legs: [leg(p(48, 92), p(41, 111)), leg(p(80, 92), p(88, 111))], floorY: 116,
});

const chestSupportedRowFrame = (pulled: boolean): Frame => ({
  layout: 'horizontal', head: p(16, 45), shoulder: p(30, 57), hip: p(62, 74),
  arms: pulled
    ? [limb(p(38, 59), p(42, 71)), limb(p(48, 61), p(52, 73))]
    : [limb(p(35, 65), p(36, 84)), limb(p(43, 67), p(44, 86))],
  legs: [leg(p(78, 88), p(94, 107)), leg(p(84, 90), p(100, 108))], floorY: 116,
});

const pecDeckFrame = (closed: boolean): Frame => ({
  layout: 'standing', head: p(55, 15), shoulder: p(55, 36), hip: p(55, 69),
  arms: closed
    ? [limb(p(37, 39), p(47, 43)), limb(p(73, 39), p(63, 43))]
    : [limb(p(31, 38), p(22, 48)), limb(p(79, 38), p(88, 48))],
  legs: [leg(p(48, 86), p(45, 111)), leg(p(63, 86), p(66, 111))], floorY: 116,
});

const hangingLegRaiseFrame = (raised: boolean): Frame => ({
  layout: 'standing', head: p(55, raised ? 20 : 19), shoulder: p(55, raised ? 39 : 40), hip: p(55, raised ? 67 : 66),
  arms: [limb(p(41, 24), p(39, 5)), limb(p(69, 24), p(71, 5))],
  legs: raised
    ? [leg(p(45, 80), p(37, 93)), leg(p(66, 80), p(74, 93))]
    : [leg(p(48, 88), p(48, 111)), leg(p(63, 88), p(63, 111))], floorY: 116,
});

const inclineCurlFrame = (curled: boolean): Frame => ({
  layout: 'horizontal', head: p(25, 37), shoulder: p(40, 52), hip: p(66, 77),
  arms: curled
    ? [limb(p(35, 64), p(31, 50)), limb(p(48, 68), p(54, 55))]
    : [limb(p(34, 65), p(28, 86)), limb(p(48, 68), p(52, 89))],
  legs: [leg(p(77, 90), p(91, 108)), leg(p(84, 91), p(100, 108))], floorY: 116,
});

const barLockoutFrame = (): Frame => ({
  ...standing('bar'),
  arms: [limb(p(42, 47), p(42, 63)), limb(p(68, 47), p(68, 63))],
  barY: 64,
});

const seatedCalfFrame = (raised: boolean): Frame => {
  const frame = seated('rest', 'extended');
  return {
    ...frame,
    legs: [leg(p(71, 63), p(raised ? 100 : 96, raised ? 51 : 70)), leg(p(76, 67), p(raised ? 102 : 98, raised ? 55 : 73))],
    footStyle: raised ? 'toes-up' : 'flat',
  };
};

const nordicFrame = (leaned: boolean): Frame => ({
  layout: 'side',
  head: leaned ? p(15, 77) : p(53, 20),
  shoulder: leaned ? p(31, 74) : p(53, 40),
  hip: leaned ? p(56, 68) : p(55, 67),
  arms: leaned
    ? [limb(p(27, 57), p(20, 44)), limb(p(35, 58), p(28, 45))]
    : [limb(p(39, 31), p(33, 19)), limb(p(66, 31), p(72, 19))],
  legs: [leg(p(48, 90), p(34, 101)), leg(p(65, 90), p(81, 101))],
  floorY: 116,
});

const seated = (arms: 'rest' | 'press-start' | 'press-up' | 'row-start' | 'row-finish' | 'pulldown-up' | 'pulldown-down', legs: 'bent' | 'extended' = 'bent'): Frame => {
  const head = p(37, 14), shoulder = p(39, 34), hip = p(48, 66);
  const armSets: Record<typeof arms, [Pair, Pair]> = {
    rest: [limb(p(28, 47), p(29, 63)), limb(p(49, 46), p(56, 61))],
    'press-start': [limb(p(26, 36), p(31, 47)), limb(p(51, 36), p(48, 47))],
    'press-up': [limb(p(25, 17), p(28, 3)), limb(p(52, 17), p(49, 3))],
    'row-start': [limb(p(53, 47), p(72, 53)), limb(p(57, 48), p(76, 55))],
    'row-finish': [limb(p(52, 42), p(56, 55)), limb(p(55, 43), p(60, 56))],
    'pulldown-up': [limb(p(25, 19), p(29, 4)), limb(p(51, 19), p(47, 4))],
    'pulldown-down': [limb(p(28, 32), p(35, 45)), limb(p(50, 32), p(46, 45))],
  };
  const legSets: Record<typeof legs, [Pair, Pair]> = {
    bent: [leg(p(66, 70), p(82, 97)), leg(p(73, 72), p(89, 97))],
    extended: [leg(p(71, 63), p(96, 62)), leg(p(76, 67), p(98, 68))],
  };
  return { layout: 'standing', head, shoulder, hip, arms: armSets[arms], legs: legSets[legs], floorY: 116 };
};

const horizontal = (kind: 'press' | 'fly' | 'bridge' | 'crunch' | 'leg-raise' | 'ham-curl' | 'plank' | 'side-plank' | 'dragon' | 'bicycle' | 'dead-bug' | 'roller', phase: 'start' | 'finish'): Frame => {
  const head = p(15, 78), shoulder = p(29, 76), hip = p(59, 82);
  const arms: Record<string, [Pair, Pair]> = {
    pressStart: [limb(p(37, 63), p(41, 48)), limb(p(42, 65), p(46, 48))],
    pressFinish: [limb(p(37, 48), p(40, 28)), limb(p(42, 48), p(45, 28))],
    flyStart: [limb(p(37, 74), p(50, 88)), limb(p(40, 74), p(55, 88))],
    flyFinish: [limb(p(36, 59), p(43, 42)), limb(p(40, 59), p(47, 42))],
    rest: [limb(p(22, 91), p(22, 106)), limb(p(34, 91), p(34, 106))],
    crunchStart: [limb(p(28, 84), p(20, 89)), limb(p(34, 84), p(27, 90))],
    crunchFinish: [limb(p(31, 67), p(25, 58)), limb(p(38, 67), p(32, 58))],
    legRaise: [limb(p(25, 91), p(42, 96)), limb(p(34, 91), p(49, 96))],
    rolloutStart: [limb(p(38, 65), p(52, 60)), limb(p(42, 67), p(56, 62))],
    rolloutFinish: [limb(p(46, 48), p(70, 43)), limb(p(50, 50), p(74, 45))],
  };
  let frameHead = head, frameShoulder = shoulder, frameHip = hip;
  let frameArms: [Pair, Pair] = arms.rest;
  let frameLegs: [Pair, Pair] = [leg(p(75, 72), p(92, 97)), leg(p(80, 73), p(96, 97))];
  let layout: Frame['layout'] = 'horizontal';
  if (kind === 'press') frameArms = phase === 'start' ? arms.pressStart : arms.pressFinish;
  if (kind === 'fly') frameArms = phase === 'start' ? arms.flyStart : arms.flyFinish;
  if (kind === 'bridge') { frameHip = p(59, phase === 'start' ? 91 : 62); frameLegs = [leg(p(72, 70), p(91, 93)), leg(p(76, 72), p(94, 94))]; }
  if (kind === 'crunch') { frameShoulder = p(29, phase === 'start' ? 78 : 59); frameHead = p(15, phase === 'start' ? 78 : 61); frameArms = phase === 'start' ? arms.crunchStart : arms.crunchFinish; }
  if (kind === 'leg-raise') { const y = phase === 'start' ? 96 : 42; const x = phase === 'start' ? 91 : 66; frameLegs = [leg(p(74, phase === 'start' ? 85 : 65), p(x, y)), leg(p(80, phase === 'start' ? 86 : 66), p(x + 5, y + 3))]; frameArms = arms.legRaise; }
  if (kind === 'ham-curl') { layout = 'horizontal'; frameHead = p(15, 55); frameShoulder = p(30, 58); frameHip = p(60, 63); frameArms = [limb(p(22, 68), p(20, 91)), limb(p(34, 68), p(34, 91))]; frameLegs = [leg(p(76, 67), p(phase === 'start' ? 94 : 72, phase === 'start' ? 89 : 43)), leg(p(81, 68), p(98, phase === 'start' ? 89 : 48))]; }
  if (kind === 'plank') { layout = 'horizontal'; frameHead = p(12, 53); frameShoulder = p(28, 58); frameHip = p(57, 64); frameArms = [limb(p(31, 78), p(31, 94)), limb(p(36, 78), p(36, 94))]; frameLegs = [leg(p(76, 67), p(98, 75)), leg(p(82, 68), p(101, 76))]; }
  if (kind === 'side-plank') { layout = 'side'; frameHead = p(14, 53); frameShoulder = p(29, 59); frameHip = p(58, 65); frameArms = [limb(p(34, 83), p(34, 101)), limb(p(40, 80), p(41, 95))]; frameLegs = [leg(p(77, 69), p(99, 75)), leg(p(82, 74), p(101, 80))]; if (phase === 'start') frameHip = p(58, 84); }
  if (kind === 'dragon') { frameHead = p(13, phase === 'start' ? 91 : 72); frameShoulder = p(28, phase === 'start' ? 87 : 70); frameHip = p(57, phase === 'start' ? 75 : 61); frameArms = [limb(p(26, 98), p(20, 111)), limb(p(34, 97), p(34, 111))]; frameLegs = [leg(p(75, phase === 'start' ? 62 : 49), p(95, phase === 'start' ? 42 : 38)), leg(p(80, phase === 'start' ? 64 : 50), p(99, phase === 'start' ? 44 : 40))]; }
  if (kind === 'bicycle') { frameArms = arms.crunchFinish; frameHead = p(15, 66); frameShoulder = p(29, 68); frameLegs = phase === 'start' ? [leg(p(67, 65), p(82, 52)), leg(p(80, 79), p(96, 98))] : [leg(p(67, 79), p(82, 98)), leg(p(80, 60), p(95, 47))]; }
  if (kind === 'dead-bug') { frameHead = p(15, 83); frameShoulder = p(29, 81); frameHip = p(58, 84); frameArms = phase === 'start' ? [limb(p(27, 59), p(26, 40)), limb(p(35, 59), p(36, 40))] : [limb(p(20, 62), p(15, 45)), limb(p(38, 61), p(43, 45))]; frameLegs = phase === 'start' ? [leg(p(69, 64), p(72, 49)), leg(p(78, 63), p(82, 48))] : [leg(p(66, 75), p(86, 96)), leg(p(76, 62), p(79, 47))]; }
  if (kind === 'roller') { frameHead = p(14, 82); frameShoulder = p(30, 77); frameHip = p(60, 82); frameArms = arms.rest; frameLegs = [leg(p(76, 78), p(93, 99)), leg(p(81, 80), p(98, 100))]; }
  return { layout, head: frameHead, shoulder: frameShoulder, hip: frameHip, arms: frameArms, legs: frameLegs, floorY: 116, ...(kind === 'press' ? { barY: phase === 'start' ? 48 : 28 } : {}) };
};

const quadruped = (kind: 'bird-dog' | 'mountain-climber', phase: 'start' | 'finish'): Frame => {
  const head = p(18, 47), shoulder = p(36, 52), hip = p(65, 62);
  const arms: [Pair, Pair] = kind === 'bird-dog' && phase === 'finish'
    ? [limb(p(26, 64), p(12, 53)), limb(p(46, 62), p(54, 42))]
    : [limb(p(26, 66), p(25, 86)), limb(p(43, 65), p(43, 86))];
  const legs: [Pair, Pair] = kind === 'bird-dog' && phase === 'finish'
    ? [leg(p(72, 84), p(70, 109)), leg(p(80, 64), p(101, 58))]
    : kind === 'mountain-climber' && phase === 'finish'
      ? [leg(p(70, 79), p(60, 70)), leg(p(82, 72), p(100, 85))]
      : [leg(p(72, 84), p(70, 109)), leg(p(82, 84), p(99, 109))];
  return { layout: 'quadruped', head, shoulder, hip, arms, legs, floorY: 116 };
};

const P = {
  stand: standing('rest'), squat: squatFrame(false, true), frontSquat: squatFrame(true, true),
  hinge: bentOverFrame(false, 84), deadlift: bentOverFrame(false, 96), deadliftTop: barLockoutFrame(),
  lunge: standing('rest', 'lunge'), split: standing('rest', 'split'), jumpPrep: standing('rest', 'squat'), jump: standing('overhead', 'jump', 0, { footLift: 19 }), jumpAir: standing('overhead', 'jump', 0, { footLift: 19 }),
  calfLow: standing('rest', 'calf'), calfHigh: standing('rest', 'calf', 0, { footLift: 8 }), cossack: standing('rest', 'cossack', 0, { hipShift: 13 }),
  barTop: standing('bar', 'neutral', 0, { barY: 29 }), frontTop: standing('front-rack', 'neutral', 0, { barY: 29 }), overhead: standing('overhead', 'neutral', 0, { barY: 1 }), sideLow: standing('side-low'), sideHigh: standing('side-high'), frontLow: standing('front-low'), frontHigh: standing('front-high'),
  curlLow: standing('curl-low', 'neutral', 0, { barY: 63 }), curlHigh: standing('curl-high', 'neutral', 0, { barY: 31 }), pushHigh: standing('pushdown-high'), pushLow: standing('pushdown-low'), faceHigh: standing('face-high'), facePull: standing('face-pull'), rowLow: bentOverFrame(false, 83), rowPull: bentOverFrame(true, 68), woodHigh: standing('wood-high'), woodLow: standing('wood-low'), landLow: standing('landmine-low'), landHigh: standing('landmine-high'), swingLow: standing('swing-low', 'neutral', 25, { hipShift: 5 }), swingHigh: standing('swing-high'), shrugHigh: standing('raised-shoulders', 'neutral', 0, { shoulderLift: 8 }),
  hipLow: horizontal('bridge', 'start'), hipHigh: horizontal('bridge', 'finish'), benchDown: horizontal('press', 'start'), benchUp: horizontal('press', 'finish'), flyOpen: horizontal('fly', 'start'), flyClosed: horizontal('fly', 'finish'), crunchDown: horizontal('crunch', 'start'), crunchUp: horizontal('crunch', 'finish'), legDown: horizontal('leg-raise', 'start'), legUp: horizontal('leg-raise', 'finish'), plank: horizontal('plank', 'start'), sidePlank: horizontal('side-plank', 'finish'), dragonDown: horizontal('dragon', 'start'), dragonUp: horizontal('dragon', 'finish'), bicycle: horizontal('bicycle', 'start'), deadbug: horizontal('dead-bug', 'start'), roller: horizontal('roller', 'start'),
  birdDog: quadruped('bird-dog', 'finish'), mountainPlank: quadruped('mountain-climber', 'start'), mountainKnee: quadruped('mountain-climber', 'finish'),
};

const SCENES: Record<SceneKey, Scene> = {
  'back-squat': { label: 'Bar sırt üzerinde squat', start: squatFrame(false, false), finish: P.squat, equipment: ['barbell'], equipmentLabel: 'Squat rack · bar' },
  'front-squat': { label: 'Ön rack squat', start: squatFrame(true, false), finish: P.frontSquat, equipment: ['barbell'], equipmentLabel: 'Ön rack · bar' },
  hinge: { label: 'Kalça menteşesi', start: P.stand, finish: P.hinge, equipment: ['barbell'], equipmentLabel: 'Bar / dambıl' },
  'romanian-deadlift': { label: 'Romanian deadlift · dizler hafif bükülü', start: P.deadliftTop, finish: P.hinge, equipment: ['barbell'], equipmentLabel: 'Barı bacaklara yakın kaydır' },
  deadlift: { label: 'Yerden deadlift', start: P.deadlift, finish: P.deadliftTop, equipment: ['barbell'], equipmentLabel: 'Yerden bar çekişi' },
  'trap-deadlift': { label: 'Trap bar deadlift', start: P.deadlift, finish: P.deadliftTop, equipment: ['trapbar'], equipmentLabel: 'Hex bar içinde · kollar yanlarda' },
  'split-squat': { label: 'Split squat / lunge', start: P.split, finish: P.lunge, equipment: ['dumbbells'], equipmentLabel: 'Tek bacak pozisyonu' },
  nordic: { label: 'Nordic hamstring', start: nordicFrame(false), finish: nordicFrame(true), equipment: ['machine'], equipmentLabel: 'Ayak sabitleme' },
  'hip-thrust': { label: 'Kalça köprüsü / thrust', start: P.hipLow, finish: P.hipHigh, equipment: ['bench'], equipmentLabel: 'Kalça yükseltme' },
  'leg-press': { label: 'Oturmalı leg press', start: seated('rest', 'bent'), finish: seated('rest', 'extended'), equipment: ['machine'], equipmentLabel: 'Leg press makinesi' },
  'leg-extension': { label: 'Diz ekstansiyonu', start: seated('rest', 'bent'), finish: seated('rest', 'extended'), equipment: ['machine'], equipmentLabel: 'Diz açma makinesi' },
  'leg-curl': { label: 'Yüzüstü hamstring curl', start: { ...horizontal('ham-curl', 'start') }, finish: { ...horizontal('ham-curl', 'finish') }, equipment: ['machine'], equipmentLabel: 'Diz bükme makinesi' },
  calf: { label: 'Ayakta baldır yükselişi', start: P.calfLow, finish: P.calfHigh, equipment: ['none'], equipmentLabel: 'Topuk aşağı → ayak ucuna yüksel' },
  'seated-calf': { label: 'Oturarak baldır yükselişi', start: seatedCalfFrame(false), finish: seatedCalfFrame(true), equipment: ['machine'], equipmentLabel: 'Diz pedi ve ayak platformu' },
  tibialis: { label: 'Ön kaval kaldırışı', start: { ...P.calfLow, footStyle: 'flat' }, finish: { ...P.calfLow, footStyle: 'toes-up' }, equipment: ['none'], equipmentLabel: 'Topuk yerde · parmaklar yukarı' },
  copenhagen: { label: 'Copenhagen yan plank', start: { ...P.sidePlank, hip: p(58, 86) }, finish: P.sidePlank, equipment: ['bench'], equipmentLabel: 'Bench destekli yan plank' },
  'bench-press': { label: 'Bench press', start: P.benchDown, finish: P.benchUp, equipment: ['bench', 'barbell'], equipmentLabel: 'Bench · bar yolu' },
  'incline-press': { label: 'Eğimli bench press', start: { ...P.benchDown, shoulder: p(31, 69), hip: p(61, 86) }, finish: { ...P.benchUp, shoulder: p(31, 69), hip: p(61, 86) }, equipment: ['incline-bench', 'barbell'], equipmentLabel: 'Eğimli bench · bar yolu' },
  'dumbbell-press': { label: 'Dambıl bench press', start: P.benchDown, finish: P.benchUp, equipment: ['bench', 'dumbbells'], equipmentLabel: 'Bench · bağımsız dambıllar' },
  'chest-fly': { label: 'Yatarak göğüs açış', start: P.flyOpen, finish: P.flyClosed, equipment: ['bench', 'dumbbells'], equipmentLabel: 'Bench · yay çizgisi' },
  'pec-deck': { label: 'Pec deck makine açış', start: pecDeckFrame(false), finish: pecDeckFrame(true), equipment: ['machine'], equipmentLabel: 'Sırt desteği · pedleri göğüs önünde birleştir' },
  crossover: { label: 'Kablo crossover', start: P.sideHigh, finish: P.frontLow, equipment: ['cable'], equipmentLabel: 'Karşılıklı kablo çekişi' },
  dip: { label: 'Paralel bar dip', start: { ...P.stand, arms: [limb(p(42, 48), p(42, 67)), limb(p(67, 48), p(67, 67))], legs: [leg(p(48, 83), p(48, 105)), leg(p(64, 83), p(64, 105))] }, finish: { ...P.stand, arms: [limb(p(42, 34), p(42, 52)), limb(p(67, 34), p(67, 52))], legs: [leg(p(48, 87), p(54, 98)), leg(p(64, 87), p(60, 98))] }, equipment: ['machine'], equipmentLabel: 'Paralel bar · kontrollü dip' },
  'landmine-press': { label: 'Landmine çapraz press', start: P.landLow, finish: P.landHigh, equipment: ['landmine'], equipmentLabel: 'Landmine barı çapraz hatta it' },
  'plyo-pushup': { label: 'Patlayıcı şınav', start: { ...P.plank, shoulder: p(30, 58), hip: p(61, 64), arms: [limb(p(31, 77), p(31, 92)), limb(p(36, 77), p(36, 92))] }, finish: { ...P.plank, shoulder: p(30, 51), hip: p(61, 62), arms: [limb(p(30, 39), p(27, 31)), limb(p(38, 39), p(42, 31))] }, equipment: ['none'], equipmentLabel: 'Ellerden patlayıcı itiş · yumuşak iniş' },
  'bent-row': { label: 'Öne eğilerek bar row', start: P.rowLow, finish: P.rowPull, equipment: ['barbell'], equipmentLabel: 'Öne eğilerek yatay çekiş' },
  'single-arm-row': { label: 'Tek kol dambıl row', start: singleArmRowFrame(false), finish: singleArmRowFrame(true), equipment: ['bench', 'dumbbells'], equipmentLabel: 'Bir el bench desteğinde · dirsek kalçaya' },
  'tbar-row': { label: 'T-bar row', start: P.rowLow, finish: P.rowPull, equipment: ['tbar'], equipmentLabel: 'T-bar pivotu · gövde sabit' },
  'chest-supported-row': { label: 'Göğüs destekli dambıl row', start: chestSupportedRowFrame(false), finish: chestSupportedRowFrame(true), equipment: ['incline-bench', 'dumbbells'], equipmentLabel: 'Göğüs sehpada · dirsekleri geriye çek' },
  'seated-row': { label: 'Oturarak kablo row', start: seated('row-start'), finish: seated('row-finish'), equipment: ['cable'], equipmentLabel: 'Ayak dayamalı kablo çekişi' },
  pullup: { label: 'Barfiks', start: { ...P.stand, head: p(55, 25), shoulder: p(55, 43), hip: p(55, 69), arms: [limb(p(43, 27), p(40, 7)), limb(p(68, 27), p(71, 7))], legs: [leg(p(49, 91), p(53, 111)), leg(p(64, 91), p(60, 111))] }, finish: { ...P.stand, head: p(55, 15), shoulder: p(55, 33), hip: p(55, 60), arms: [limb(p(42, 30), p(40, 7)), limb(p(68, 30), p(71, 7))], legs: [leg(p(49, 83), p(53, 104)), leg(p(64, 83), p(60, 104))] }, equipment: ['pullup-bar'], equipmentLabel: 'Asılma → göğsü bara yaklaştır' },
  pulldown: { label: 'Lat pulldown', start: seated('pulldown-up'), finish: seated('pulldown-down'), equipment: ['machine'], equipmentLabel: 'Üst makara · dikey çekiş' },
  'face-pull': { label: 'Yüze face pull', start: P.faceHigh, finish: P.facePull, equipment: ['cable'], equipmentLabel: 'Yüz hizasına kablo çekişi' },
  'straight-pulldown': { label: 'Düz kol lat pulldown', start: P.overhead, finish: P.pushLow, equipment: ['cable'], equipmentLabel: 'Dirsek açısı sabit · üstten aşağı' },
  shrug: { label: 'Omuz silkme', start: P.stand, finish: P.shrugHigh, equipment: ['dumbbells'], equipmentLabel: 'Omuzlar yukarı · kollar uzun' },
  'back-extension': { label: 'Kalça menteşeli sırt açışı', start: P.hinge, finish: P.deadliftTop, equipment: ['machine'], equipmentLabel: 'Hiperextension sehpası' },
  'overhead-press': { label: 'Baş üstü press', start: P.frontTop, finish: P.overhead, equipment: ['barbell'], equipmentLabel: 'Omuz hizasından baş üstüne' },
  'lateral-raise': { label: 'Yana omuz açış', start: P.sideLow, finish: P.sideHigh, equipment: ['dumbbells'], equipmentLabel: 'Yana kontrollü kaldırış' },
  'cable-lateral-raise': { label: 'Kablo yana omuz açış', start: P.sideLow, finish: P.sideHigh, equipment: ['cable'], equipmentLabel: 'Alçak makaradan yana çekiş' },
  'front-raise': { label: 'Öne omuz kaldırış', start: P.frontLow, finish: P.frontHigh, equipment: ['dumbbells'], equipmentLabel: 'Öne kontrollü kaldırış' },
  'rear-fly': { label: 'Arka omuz açış', start: P.hinge, finish: { ...P.hinge, arms: [limb(p(36, 48), p(26, 43)), limb(p(72, 48), p(82, 43))] }, equipment: ['dumbbells'], equipmentLabel: 'Öne eğik arka omuz açış' },
  'upright-row': { label: 'Dikey row', start: P.curlLow, finish: { ...P.curlHigh, barY: 38, arms: [limb(p(37, 22), p(43, 38)), limb(p(73, 22), p(67, 38))] }, equipment: ['barbell'], equipmentLabel: 'Dirsekler öne-yukarı' },
  'push-press': { label: 'Landmine push press', start: P.landLow, finish: P.landHigh, equipment: ['landmine'], equipmentLabel: 'Diz-kalça dipinden çapraz itiş' },
  curl: { label: 'Dirsek bükme', start: P.curlLow, finish: P.curlHigh, equipment: ['barbell'], equipmentLabel: 'Dirsek gövde yanında' },
  'dumbbell-curl': { label: 'Dambıl hammer curl', start: P.curlLow, finish: P.curlHigh, equipment: ['dumbbells'], equipmentLabel: 'Nötr tutuş · dirsekler sabit' },
  'cable-curl': { label: 'Kablo curl', start: P.curlLow, finish: P.curlHigh, equipment: ['cable'], equipmentLabel: 'Alçak makaradan kontrollü büküş' },
  'incline-curl': { label: 'Eğimli bench dambıl curl', start: inclineCurlFrame(false), finish: inclineCurlFrame(true), equipment: ['incline-bench', 'dumbbells'], equipmentLabel: 'Sırt destekli · üst kol geride sabit' },
  'preacher-curl': { label: 'Preacher curl', start: { ...P.curlLow, shoulder: p(50, 43), hip: p(55, 75), arms: [limb(p(42, 62), p(39, 83)), limb(p(66, 62), p(67, 83))] }, finish: { ...P.curlHigh, shoulder: p(50, 43), hip: p(55, 75), arms: [limb(p(42, 59), p(39, 47)), limb(p(66, 59), p(67, 47))] }, equipment: ['machine'], equipmentLabel: 'Üst kol sehpa pedinde sabit' },
  pushdown: { label: 'Triceps pushdown', start: P.pushHigh, finish: P.pushLow, equipment: ['cable'], equipmentLabel: 'Dirsek sabit · kablo aşağı' },
  skullcrusher: { label: 'Yatarak triceps extension', start: P.benchDown, finish: { ...P.benchDown, arms: [limb(p(35, 51), p(35, 33)), limb(p(42, 52), p(42, 33))] }, equipment: ['bench', 'dumbbells'], equipmentLabel: 'Yatarak dirsek açma' },
  'overhead-triceps': { label: 'Baş üstü triceps extension', start: P.overhead, finish: { ...P.overhead, arms: [limb(p(37, 13), p(37, 30)), limb(p(73, 13), p(73, 30))] }, equipment: ['dumbbells'], equipmentLabel: 'Üst kol baş yanında sabit' },
  plank: { label: 'Ön plank', start: P.plank, finish: P.plank, equipment: ['none'], equipmentLabel: 'Baş-omuz-kalça-topuk hizası' },
  'side-plank': { label: 'Yan plank', start: { ...P.sidePlank, hip: p(58, 84) }, finish: P.sidePlank, equipment: ['none'], equipmentLabel: 'Dirsek altında omuz · kalça kalkık' },
  'leg-raise': { label: 'Yatarak bacak kaldırma', start: P.legDown, finish: P.legUp, equipment: ['none'], equipmentLabel: 'Pelvis sabit · bacak kontrollü yükselir' },
  'hanging-leg-raise': { label: 'Asılı diz / bacak kaldırma', start: hangingLegRaiseFrame(false), finish: hangingLegRaiseFrame(true), equipment: ['pullup-bar'], equipmentLabel: 'Barfiks barında asıl · bacakları kontrollü kaldır' },
  rollout: { label: 'Ab wheel rollout', start: { ...P.plank, layout: 'quadruped', head: p(22, 55), shoulder: p(38, 60), hip: p(63, 70), arms: [limb(p(34, 67), p(48, 62)), limb(p(40, 69), p(54, 64))], legs: [leg(p(71, 87), p(72, 108)), leg(p(82, 87), p(82, 108))] }, finish: { ...P.plank, layout: 'quadruped', head: p(22, 43), shoulder: p(39, 50), hip: p(64, 65), arms: [limb(p(47, 49), p(67, 44)), limb(p(52, 51), p(72, 46))], legs: [leg(p(72, 83), p(72, 108)), leg(p(83, 83), p(83, 108))] }, equipment: ['roller'], equipmentLabel: 'Diz üstünde ileri yuvarla · gövdeyi sabitle' },
  woodchop: { label: 'Kablo woodchop', start: P.woodHigh, finish: P.woodLow, equipment: ['cable'], equipmentLabel: 'Çapraz yüksekten alçağa' },
  pallof: { label: 'Pallof anti-rotasyon', start: P.landLow, finish: standing('front-low', 'neutral'), equipment: ['cable'], equipmentLabel: 'Kollar uzarken gövde dönmez' },
  'russian-twist': { label: 'Oturarak gövde rotasyonu', start: { ...P.crunchDown, head: p(35, 46), shoulder: p(43, 62), hip: p(57, 83), arms: [limb(p(48, 62), p(57, 58)), limb(p(52, 62), p(61, 58))], legs: [leg(p(72, 78), p(90, 104)), leg(p(78, 79), p(96, 104))] }, finish: { ...P.crunchDown, head: p(35, 46), shoulder: p(43, 62), hip: p(57, 83), arms: [limb(p(53, 62), p(42, 58)), limb(p(57, 62), p(46, 58))], legs: [leg(p(72, 78), p(90, 104)), leg(p(78, 79), p(96, 104))] }, equipment: ['ball'], equipmentLabel: 'Sağ-sol kontrollü dönüş' },
  'dragon-flag': { label: 'Dragon flag gövde hattı', start: P.dragonDown, finish: P.dragonUp, equipment: ['bench'], equipmentLabel: 'Gövde tek parça · kontrollü kaldıraç' },
  'bicycle-crunch': { label: 'Bicycle crunch', start: P.bicycle, finish: { ...P.bicycle, legs: [leg(p(68, 79), p(83, 98)), leg(p(80, 61), p(95, 48))], arms: [limb(p(29, 66), p(38, 59)), limb(p(37, 66), p(27, 59))] }, equipment: ['none'], equipmentLabel: 'Karşı dirsek · karşı diz' },
  'dead-bug': { label: 'Dead bug', start: P.deadbug, finish: { ...P.deadbug, arms: [limb(p(20, 62), p(15, 45)), limb(p(38, 61), p(43, 45))], legs: [leg(p(66, 75), p(86, 96)), leg(p(76, 62), p(79, 47))] }, equipment: ['none'], equipmentLabel: 'Karşı kol-bacak uzat · bel sabit' },
  'bird-dog': { label: 'Bird dog', start: P.birdDog, finish: P.birdDog, equipment: ['none'], equipmentLabel: 'Dört ayak · karşı kol ve bacak uzar' },
  'mountain-climber': { label: 'Mountain climber', start: P.mountainPlank, finish: P.mountainKnee, equipment: ['none'], equipmentLabel: 'Plankta dönüşümlü diz çekişi' },
  'box-jump': { label: 'Box jump inişi', start: P.jumpPrep, finish: { ...P.jump, legs: [leg(p(40, 83), p(38, 92)), leg(p(72, 83), p(75, 92))] }, equipment: ['box'], equipmentLabel: 'Alçak kutuya kontrollü iniş' },
  'broad-jump': { label: 'İleri broad jump', start: P.jumpPrep, finish: { ...P.jump, head: p(70, 33), shoulder: p(67, 48), hip: p(56, 69), arms: [limb(p(47, 42), p(35, 35)), limb(p(75, 42), p(88, 35))], legs: [leg(p(45, 82), p(30, 103)), leg(p(74, 82), p(87, 103))] }, equipment: ['none'], equipmentLabel: 'İleri sıçrama · dengeli stick inişi' },
  'single-hop': { label: 'Tek ayak hop-and-stick', start: P.calfLow, finish: { ...P.stand, legs: [leg(p(49, 83), p(48, 109)), leg(p(64, 81), p(73, 89))] }, equipment: ['none'], equipmentLabel: 'Tek ayak inişi · dengeyi sabitle' },
  'kettlebell-swing': { label: 'Kettlebell hinge swing', start: P.swingLow, finish: P.swingHigh, equipment: ['kettlebell'], equipmentLabel: 'Kalça menteşesinden salınım' },
  cossack: { label: 'Yanal Cossack squat', start: P.split, finish: P.cossack, equipment: ['none'], equipmentLabel: 'Geniş duruş · bir diz bükülür' },
  'hip-90': { label: '90/90 oturarak kalça mobilitesi', start: { ...P.crunchDown, head: p(35, 16), shoulder: p(42, 34), hip: p(57, 70), arms: [limb(p(28, 45), p(26, 62)), limb(p(53, 45), p(58, 61))], legs: [leg(p(39, 83), p(25, 98)), leg(p(78, 78), p(95, 88))] }, finish: { ...P.crunchDown, head: p(35, 16), shoulder: p(42, 34), hip: p(57, 70), arms: [limb(p(32, 49), p(34, 66)), limb(p(53, 45), p(58, 61))], legs: [leg(p(39, 83), p(25, 98)), leg(p(78, 78), p(95, 88))] }, equipment: ['none'], equipmentLabel: 'Yerde oturma · kalça kontrollü döner' },
  spiderman: { label: 'Spiderman lunge + thoracic rotation', start: P.mountainPlank, finish: { ...P.mountainKnee, arms: [limb(p(32, 59), p(20, 42)), limb(p(47, 48), p(55, 29))], legs: [leg(p(63, 77), p(54, 80)), leg(p(81, 83), p(100, 108))] }, equipment: ['none'], equipmentLabel: 'Ayağı el dışına getir · göğüs kafesini aç' },
  'foam-roll': { label: 'Köpük rulo üzerinde mobilite', start: P.roller, finish: { ...P.roller, shoulder: p(30, 68), head: p(14, 73) }, equipment: ['roller'], equipmentLabel: 'Kas üzerinde hafif ve kontrollü basınç' },
  pogo: { label: 'Pogo düşük sıçrama', start: P.calfLow, finish: { ...P.calfHigh, legs: [leg(p(46, 81), p(43, 102)), leg(p(65, 81), p(68, 102))] }, equipment: ['none'], equipmentLabel: 'Alçak, seri ayak bileği yaylanması' },
  'rotational-slam': { label: 'Rotasyonlu sağlık topu slam', start: P.woodHigh, finish: P.woodLow, equipment: ['ball'], equipmentLabel: 'Gövde rotasyonu · topu çapraz zemine indir' },
  'lateral-bound': { label: 'Yanal bound inişi', start: P.split, finish: { ...P.jump, head: p(72, 25), shoulder: p(69, 42), hip: p(58, 66), legs: [leg(p(53, 82), p(51, 108)), leg(p(75, 79), p(92, 99))] }, equipment: ['none'], equipmentLabel: 'Yana itiş · tek ayakta denge' },
  'monster-walk': { label: 'Bantlı monster walk', start: standing('rest', 'squat'), finish: standing('rest', 'split'), equipment: ['band'], equipmentLabel: 'Mini-band gergin · küçük yan adım' },
};

const ID_SCENES: Record<string, SceneKey> = {
  'ex-leg-1': 'back-squat', 'ex-leg-2': 'front-squat', 'ex-leg-3': 'split-squat', 'ex-leg-4': 'romanian-deadlift', 'ex-leg-5': 'nordic', 'ex-leg-6': 'deadlift', 'ex-leg-7': 'trap-deadlift', 'ex-leg-8': 'split-squat', 'ex-leg-9': 'hip-thrust', 'ex-leg-10': 'leg-press', 'ex-leg-11': 'leg-extension', 'ex-leg-12': 'leg-curl', 'ex-leg-13': 'calf', 'ex-leg-14': 'seated-calf', 'ex-leg-15': 'tibialis', 'ex-leg-16': 'copenhagen',
  'ex-ch-1': 'bench-press', 'ex-ch-2': 'incline-press', 'ex-ch-3': 'incline-press', 'ex-ch-4': 'dumbbell-press', 'ex-ch-5': 'chest-fly', 'ex-ch-6': 'crossover', 'ex-ch-7': 'dip', 'ex-ch-8': 'pec-deck', 'ex-ch-9': 'landmine-press', 'ex-ch-10': 'plyo-pushup',
  'ex-bk-1': 'bent-row', 'ex-bk-2': 'pullup', 'ex-bk-3': 'pulldown', 'ex-bk-4': 'seated-row', 'ex-bk-5': 'single-arm-row', 'ex-bk-6': 'tbar-row', 'ex-bk-7': 'face-pull', 'ex-bk-8': 'chest-supported-row', 'ex-bk-9': 'straight-pulldown', 'ex-bk-10': 'shrug', 'ex-bk-11': 'back-extension',
  'ex-sh-1': 'overhead-press', 'ex-sh-2': 'overhead-press', 'ex-sh-3': 'lateral-raise', 'ex-sh-4': 'cable-lateral-raise', 'ex-sh-5': 'overhead-press', 'ex-sh-6': 'front-raise', 'ex-sh-7': 'rear-fly', 'ex-sh-8': 'rear-fly', 'ex-sh-9': 'upright-row', 'ex-sh-10': 'push-press',
  'ex-arm-1': 'curl', 'ex-arm-2': 'dumbbell-curl', 'ex-arm-3': 'incline-curl', 'ex-arm-4': 'preacher-curl', 'ex-arm-5': 'cable-curl', 'ex-arm-6': 'pushdown', 'ex-arm-7': 'skullcrusher', 'ex-arm-8': 'overhead-triceps', 'ex-arm-9': 'dip', 'ex-arm-10': 'bench-press',
  'ex-cr-1': 'plank', 'ex-cr-2': 'side-plank', 'ex-cr-3': 'hanging-leg-raise', 'ex-cr-4': 'rollout', 'ex-cr-5': 'woodchop', 'ex-cr-6': 'pallof', 'ex-cr-7': 'russian-twist', 'ex-cr-8': 'dragon-flag', 'ex-cr-9': 'bicycle-crunch', 'ex-cr-10': 'dead-bug', 'ex-cr-11': 'bird-dog', 'ex-cr-12': 'mountain-climber',
  'ex-fb-1': 'box-jump', 'ex-fb-2': 'broad-jump', 'ex-fb-3': 'single-hop', 'ex-fb-4': 'kettlebell-swing', 'ex-fb-5': 'cossack', 'ex-fb-6': 'hip-90', 'ex-fb-7': 'spiderman', 'ex-fb-8': 'foam-roll', 'ex-fb-9': 'pogo', 'ex-fb-10': 'rotational-slam', 'ex-fb-11': 'lateral-bound', 'ex-fb-12': 'monster-walk',
};

const PATTERN_FALLBACK: Record<string, SceneKey> = {
  squat: 'back-squat', hinge: 'hinge', lunge: 'split-squat', bridge: 'hip-thrust', 'leg-machine': 'leg-extension', push: 'bench-press', fly: 'chest-fly', row: 'bent-row', pull: 'pulldown', press: 'overhead-press', raise: 'lateral-raise', shrug: 'shrug', curl: 'curl', triceps: 'pushdown', plank: 'plank', crunch: 'bicycle-crunch', 'leg-raise': 'leg-raise', rotation: 'woodchop', jump: 'box-jump', mobility: 'hip-90', band: 'monster-walk', calf: 'calf', tibialis: 'tibialis',
};

const STANDING_HOTSPOTS: Record<MuscleGroup, Point> = {
  chest: p(55, 43), back: p(57, 48), shoulders: p(43, 32), rearDelts: p(67, 32), traps: p(55, 27), biceps: p(43, 46), triceps: p(67, 46), forearms: p(39, 59), core: p(55, 51), obliques: p(46, 53), hipFlexors: p(61, 62), quadriceps: p(45, 78), hamstrings: p(65, 78), glutes: p(64, 62), adductors: p(55, 77), calves: p(66, 97), tibialis: p(43, 97),
};
const FLOOR_HOTSPOTS: Record<MuscleGroup, Point> = {
  chest: p(36, 65), back: p(43, 61), shoulders: p(30, 58), rearDelts: p(35, 63), traps: p(32, 56), biceps: p(30, 65), triceps: p(28, 69), forearms: p(25, 81), core: p(47, 79), obliques: p(48, 84), hipFlexors: p(62, 74), quadriceps: p(73, 75), hamstrings: p(76, 73), glutes: p(61, 76), adductors: p(68, 79), calves: p(90, 84), tibialis: p(88, 86),
};

function Person({ frame, muscles, sceneKey, bodyGradientId, muscleGradientId, showBarbell }: {
  frame: Frame;
  muscles: MuscleGroup[];
  sceneKey: SceneKey;
  bodyGradientId: string;
  muscleGradientId: string;
  showBarbell: boolean;
}) {
  const points = frame.layout === 'standing' ? STANDING_HOTSPOTS : FLOOR_HOTSPOTS;
  const nearArm = frame.arms[0], farArm = frame.arms[1];
  const nearLeg = frame.legs[0], farLeg = frame.legs[1];
  const nearArmPath = `M ${frame.shoulder[0] - 2} ${frame.shoulder[1]} L ${nearArm[0][0]} ${nearArm[0][1]} L ${nearArm[1][0]} ${nearArm[1][1]}`;
  const farArmPath = `M ${frame.shoulder[0] + 2} ${frame.shoulder[1]} L ${farArm[0][0] + 2} ${farArm[0][1]} L ${farArm[1][0] + 2} ${farArm[1][1]}`;
  const nearLegPath = `M ${frame.hip[0] - 3} ${frame.hip[1]} L ${nearLeg[0][0]} ${nearLeg[0][1]} L ${nearLeg[1][0]} ${nearLeg[1][1]}`;
  const farLegPath = `M ${frame.hip[0] + 3} ${frame.hip[1]} L ${farLeg[0][0] + 2} ${farLeg[0][1]} L ${farLeg[1][0] + 2} ${farLeg[1][1]}`;
  const shoulderWidth = frame.layout === 'standing' ? 9 : 7;
  return <g className={`visual-person visual-person--${frame.layout}`} aria-label={sceneKey}>
    <ellipse cx={(nearLeg[1][0] + farLeg[1][0]) / 2} cy={frame.floorY + 1.5} rx="20" ry="2.2" fill="#06111d" opacity=".58" />
    <line x1="5" y1={frame.floorY} x2="105" y2={frame.floorY} stroke="#33465a" strokeWidth="1.2" />
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={farLegPath} stroke="#0b1623" strokeWidth="10" />
      <path d={farArmPath} stroke="#0b1623" strokeWidth="9" />
      <path d={farLegPath} stroke="#8295a9" strokeWidth="6" />
      <path d={farArmPath} stroke="#8295a9" strokeWidth="5.5" />
    </g>
    <path
      d={`M ${frame.shoulder[0] - shoulderWidth} ${frame.shoulder[1] - 2} Q ${frame.shoulder[0]} ${frame.shoulder[1] - 8} ${frame.shoulder[0] + shoulderWidth} ${frame.shoulder[1] - 2} L ${frame.hip[0] + 7} ${frame.hip[1] - 3} Q ${frame.hip[0]} ${frame.hip[1] + 5} ${frame.hip[0] - 7} ${frame.hip[1] - 3} Z`}
      fill={`url(#${bodyGradientId})`} stroke="#e4edf5" strokeWidth="1.2"
    />
    {frame.layout === 'standing' && <g fill="none" stroke="#718399" strokeWidth=".9" opacity=".8">
      <path d={`M ${frame.shoulder[0] - 6} ${frame.shoulder[1] + 3} Q ${frame.shoulder[0]} ${frame.shoulder[1] + 7} ${frame.shoulder[0] + 6} ${frame.shoulder[1] + 3}`} />
      <path d={`M ${frame.hip[0]} ${frame.shoulder[1] + 9} V ${frame.hip[1] - 5} M ${frame.hip[0] - 4} ${frame.shoulder[1] + 17} H ${frame.hip[0] + 4} M ${frame.hip[0] - 4} ${frame.shoulder[1] + 23} H ${frame.hip[0] + 4}`} />
    </g>}
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={nearLegPath} stroke="#0b1623" strokeWidth="13" />
      <path d={nearArmPath} stroke="#0b1623" strokeWidth="12" />
      <path d={nearLegPath} stroke={`url(#${bodyGradientId})`} strokeWidth="9" />
      <path d={nearArmPath} stroke={`url(#${bodyGradientId})`} strokeWidth="8" />
      <path d={nearLegPath} stroke="#f0f5fa" strokeWidth="1" opacity=".4" />
      <path d={nearArmPath} stroke="#f0f5fa" strokeWidth="1" opacity=".4" />
    </g>
    {muscles.slice(0, 3).map((muscle) => {
      const [x, y] = points[muscle];
      return <g key={muscle} className="visual-muscle-highlight" aria-hidden="true">
        <ellipse cx={x} cy={y} rx="6.2" ry="4.8" fill={`url(#${muscleGradientId})`} stroke="#c1ffdb" strokeWidth=".8" />
        <ellipse cx={x - 1} cy={y - 1} rx="2.1" ry="1.1" fill="#effff5" opacity=".55" />
      </g>;
    })}
    <path d={`M ${frame.shoulder[0]} ${frame.shoulder[1] - 3} L ${frame.head[0]} ${frame.head[1] + 6}`} stroke="#91a4ba" strokeWidth="6" strokeLinecap="round" />
    <path d={`M ${frame.shoulder[0]} ${frame.shoulder[1] - 3} L ${frame.head[0]} ${frame.head[1] + 6}`} stroke="#d5e0eb" strokeWidth="3.7" strokeLinecap="round" />
    <circle cx={frame.head[0]} cy={frame.head[1]} r="7" fill={`url(#${bodyGradientId})`} stroke="#f3f7fb" strokeWidth="1.2" />
    <g fill="#dce7f0" stroke="#f4f8fb" strokeWidth=".6">
      {[nearArm[0], farArm[0], nearLeg[0], farLeg[0]].map(([x, y], index) => <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="3.1" />)}
      <circle cx={frame.hip[0]} cy={frame.hip[1]} r="3.2" />
    </g>
    {frame.legs.map(([, [x, y]], index) => <path key={`foot-${index}`} d={frame.footStyle === 'toes-up' ? `M ${x - 3} ${y + 1} l 8 -7` : frame.footStyle === 'heels-up' ? `M ${x - 3} ${y + 2} l 8 -2` : `M ${x - 3} ${y} l 8 2`} fill="none" stroke="#dbe5ed" strokeWidth="3" strokeLinecap="round" />)}
    {showBarbell && frame.barY !== undefined && <g className="visual-barbell"><line x1="7" y1={frame.barY} x2="103" y2={frame.barY} stroke="#d5e1eb" strokeWidth="3" /><rect x="8" y={frame.barY - 7} width="5" height="14" rx="1" fill="#8295a9" /><rect x="97" y={frame.barY - 7} width="5" height="14" rx="1" fill="#8295a9" /></g>}
  </g>;
}

function EquipmentDrawing({ equipment, frame }: { equipment: Equipment[]; frame: Frame }) {
  return <g className="visual-equipment" fill="none" stroke="#91a4ba" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".88">
    {equipment.includes('barbell') && frame.barY === undefined && <g><line x1="8" y1="28" x2="102" y2="28" strokeWidth="3" /><rect x="8" y="22" width="5" height="12" rx="1" /><rect x="97" y="22" width="5" height="12" rx="1" /></g>}
    {equipment.includes('trapbar') && <g><path d="M 35 72 L 44 64 H 68 L 78 72 L 74 96 H 39 Z" strokeWidth="2.8" /><path d="M 45 67 V 91 M 67 67 V 91" strokeWidth="3" /><rect x="27" y="91" width="8" height="13" rx="2" fill="#60748a" /><rect x="78" y="91" width="8" height="13" rx="2" fill="#60748a" /></g>}
    {equipment.includes('tbar') && <g><path d={`M 13 109 L ${frame.arms[0][1][0]} ${frame.arms[0][1][1]}`} strokeWidth="3.4" /><circle cx="13" cy="103" r="7" fill="#596e84" stroke="#a6b8cb" /><path d="M 12 110 H 23" strokeWidth="3" /></g>}
    {equipment.includes('landmine') && <g><path d={`M 14 109 L ${frame.arms[0][1][0]} ${frame.arms[0][1][1]}`} strokeWidth="3.8" /><circle cx="14" cy="109" r="6" fill="#667b91" stroke="#bdcad7" /><path d="M 7 114 H 21" strokeWidth="4" /></g>}
    {(equipment.includes('bench') || equipment.includes('incline-bench')) && <g><path d={equipment.includes('incline-bench') ? 'M 16 95 L 80 76 L 87 82 L 22 101 Z' : 'M 16 91 H 89 V 98 H 16 Z'} fill="#34485e" /><path d="M 24 98 L 21 112 M 81 98 L 84 112" /></g>}
    {equipment.includes('pullup-bar') && <g><path d="M 12 12 H 100 M 17 12 V 25 M 95 12 V 25" strokeWidth="3" /></g>}
    {equipment.includes('machine') && <g><path d="M 91 35 V 103 H 103 M 88 51 H 97 M 88 58 H 97 M 88 65 H 97" /><path d="M 26 72 H 58 V 78 H 26 Z M 28 78 V 91 M 57 78 V 91" fill="#34485e" /></g>}
    {equipment.includes('cable') && <g><rect x="94" y="15" width="8" height="91" rx="2" fill="#34485e" /><circle cx="98" cy="25" r="3" fill="#9aacc0" /><path d={`M 98 25 L ${frame.arms[0][1][0]} ${frame.arms[0][1][1]}`} strokeDasharray="3 2" /></g>}
    {equipment.includes('box') && <g><path d="M 63 80 H 101 V 111 H 63 Z" fill="#34485e" /><path d="M 68 84 H 96" stroke="#61768d" /></g>}
    {equipment.includes('band') && <ellipse cx="55" cy="83" rx="25" ry="7" stroke="#70e4a4" strokeWidth="2.5" />}
    {equipment.includes('kettlebell') && <g><path d="M 45 95 C 47 80, 64 80, 66 95 Z" fill="#41556c" /><path d="M 50 85 C 50 77, 61 77, 61 85" /></g>}
    {equipment.includes('ball') && <circle cx={frame.arms[0][1][0]} cy={frame.arms[0][1][1]} r="7" fill="#e6b65c" stroke="#ffdc93" />}
    {equipment.includes('roller') && <g><rect x="37" y="91" width="25" height="10" rx="5" fill="#48627a" /><path d="M 40 94 H 59 M 40 98 H 59" stroke="#81a2bf" /></g>}
    {equipment.includes('dumbbells') && <g fill="#8295aa"><circle cx={frame.arms[0][1][0]} cy={frame.arms[0][1][1]} r="4.3" /><circle cx={frame.arms[1][1][0]} cy={frame.arms[1][1][1]} r="4.3" /></g>}
  </g>;
}

function getScene(exercise: ExerciseDefinition, pattern: string): [SceneKey, Scene] {
  const key = ID_SCENES[exercise.id] ?? PATTERN_FALLBACK[pattern] ?? 'back-squat';
  return [key, SCENES[key]];
}

function MovementSceneGraphic({ exercise, scene, sceneKey, muscles, compact, progress }: {
  exercise: ExerciseDefinition;
  scene: Scene;
  sceneKey: SceneKey;
  muscles: MuscleGroup[];
  compact: boolean;
  progress: number;
}) {
  const gradientId = `movement-scene-${useId().replace(/:/g, '')}`;
  const bodyGradientId = `${gradientId}-body`;
  const muscleGradientId = `${gradientId}-muscle`;
  const gridPatternId = `${gradientId}-grid`;
  const movesBar = scene.equipment.includes('barbell');
  const frame = interpolateFrame(scene.start, scene.finish, progress, movesBar);
  const renderPerson = (activeFrame: Frame) => <>
    <EquipmentDrawing equipment={scene.equipment} frame={activeFrame} />
    <Person frame={activeFrame} muscles={muscles} sceneKey={sceneKey} bodyGradientId={bodyGradientId} muscleGradientId={muscleGradientId} showBarbell={movesBar} />
  </>;
  return <svg viewBox="0 0 300 174" data-scene-key={sceneKey} data-progress={compact ? undefined : progress.toFixed(2)} role="img" aria-label={`${exercise.name}: ${scene.label}; ${scene.equipmentLabel}; ${compact ? 'başlangıç ve tekrar sonu pozları' : 'kontrollü hareket canlandırması'}`}>
    <title>{exercise.name} — hareket şeması</title>
    <desc>{scene.label}. {scene.equipmentLabel}. Yeşil vurgular ana kas gruplarını şematik olarak gösterir.</desc>
    <defs>
      <linearGradient id={gradientId} x1="0" x2="1"><stop stopColor="#122b23" /><stop offset="1" stopColor="#17283c" /></linearGradient>
      <linearGradient id={bodyGradientId} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#d7e1ea" /><stop offset=".48" stopColor="#a8bacb" /><stop offset="1" stopColor="#8295a9" /></linearGradient>
      <radialGradient id={muscleGradientId}><stop stopColor="#b9ffd4" /><stop offset=".55" stopColor="#54df91" /><stop offset="1" stopColor="#1c9a5d" /></radialGradient>
      <pattern id={gridPatternId} width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 18 0 H 0 V 18" fill="none" stroke="#91a4ba" strokeOpacity=".08" strokeWidth=".7" /></pattern>
    </defs>
    <rect x="3" y="3" width="294" height="168" rx="17" fill={`url(#${gradientId})`} />
    <rect x="3" y="3" width="294" height="168" rx="17" fill={`url(#${gridPatternId})`} />
    {compact ? <>
      <circle cx="77" cy="83" r="48" fill="#68e0a1" opacity=".035" />
      <circle cx="228" cy="83" r="48" fill="#75a4ff" opacity=".04" />
      <path d="M150 18 V146" stroke="#7c91a8" strokeOpacity=".16" strokeDasharray="3 5" />
      <g transform="translate(16 20) scale(.94)">{renderPerson(scene.start)}</g>
      <circle cx="150" cy="81" r="14" fill="#102b22" stroke="#36664d" strokeWidth="1" />
      <path d="M140 81h20m-7-7 7 7-7 7" fill="none" stroke="#8cf0b2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(168 20) scale(.94)">{renderPerson(scene.finish)}</g>
      <text x="68" y="161" textAnchor="middle" fill="#a9bbce" fontSize="9" fontWeight="800">BAŞLANGIÇ</text>
      <text x="230" y="161" textAnchor="middle" fill="#8deeb4" fontSize="9" fontWeight="800">TEKRAR SONU</text>
    </> : <>
      <circle cx="150" cy="84" r="70" fill="#68e0a1" opacity=".04" />
      <path d="M150 18 V146" stroke="#7c91a8" strokeOpacity=".12" strokeDasharray="3 6" />
      <g transform="translate(96 18) scale(1.02)">{renderPerson(frame)}</g>
      <text x="150" y="160" textAnchor="middle" fill="#a9bbce" fontSize="9" fontWeight="800">{progress < .02 ? 'BAŞLANGIÇ POZU' : progress > .98 ? 'TEKRAR SONU' : 'HAREKET AKIŞI'}</text>
    </>}
  </svg>;
}

function StaticMovementIllustration({ exercise, pattern }: { exercise: ExerciseDefinition; pattern: string }) {
  const [sceneKey, scene] = getScene(exercise, pattern);
  const muscles = mapExerciseMuscles(exercise)?.primary ?? [];
  return <div className="movement-illustration movement-illustration--compact">
    <MovementSceneGraphic exercise={exercise} scene={scene} sceneKey={sceneKey} muscles={muscles} compact progress={0} />
  </div>;
}

function AnimatedMovementIllustration({ exercise, pattern }: { exercise: ExerciseDefinition; pattern: string }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sceneKey, scene] = getScene(exercise, pattern);
  const muscles = mapExerciseMuscles(exercise)?.primary ?? [];

  useEffect(() => {
    if (!playing) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof window.requestAnimationFrame !== 'function') {
      setPlaying(false);
      return undefined;
    }
    let animationFrame = 0;
    let startedAt: number | undefined;
    const tick = (now: number) => {
      startedAt ??= now - progress * 1800;
      const nextProgress = Math.min(1, (now - startedAt) / 1800);
      setProgress(nextProgress);
      if (nextProgress >= 1) {
        setPlaying(false);
        return;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [playing]);

  return <div className="movement-illustration movement-illustration--animated">
    <MovementSceneGraphic exercise={exercise} scene={scene} sceneKey={sceneKey} muscles={muscles} compact={false} progress={progress} />
    <div className="movement-playback" aria-label="Hareket canlandırma kontrolleri">
      <div className="movement-playback__buttons">
        <button type="button" className="movement-playback__toggle" onClick={() => {
          if (progress >= 1) setProgress(0);
          setPlaying((wasPlaying) => !wasPlaying);
        }} aria-label={playing ? 'Canlandırmayı duraklat' : 'Canlandırmayı oynat'} aria-pressed={playing}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>{playing ? 'Duraklat' : 'Canlandır'}
        </button>
        <button type="button" className="movement-playback__reset" onClick={() => { setPlaying(false); setProgress(0); }}>Başa al</button>
        <span className="movement-playback__phase" aria-live="polite">{progress < .02 ? 'Başlangıç' : progress > .98 ? 'Tekrar sonu' : `${Math.round(progress * 100)}%`}</span>
      </div>
      <label className="movement-playback__scrubber">
        <span className="sr-only">Hareket aşaması</span>
        <input type="range" min="0" max="1" step="0.01" value={progress} aria-label="Hareket aşaması" onChange={(event) => { setPlaying(false); setProgress(Number(event.target.value)); }} />
      </label>
    </div>
  </div>;
}

function MovementIllustrationView({ exercise, pattern, compact = false }: { exercise: ExerciseDefinition; pattern: string; compact?: boolean }) {
  return compact
    ? <StaticMovementIllustration exercise={exercise} pattern={pattern} />
    : <AnimatedMovementIllustration exercise={exercise} pattern={pattern} />;
}
export const BUILTIN_SCENE_IDS = Object.freeze(Object.keys(ID_SCENES));
export const BUILTIN_SCENE_COUNT = BUILTIN_SCENE_IDS.length;

export default memo(MovementIllustrationView);
