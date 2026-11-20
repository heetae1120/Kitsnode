export const WHEEL_COUNT = 34;
export const DEAL_MS = 2600;
export const LIFT_MS = 1900;
export const CARD_WIDTH = 144;
export const CARD_HEIGHT = 256;
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const wrapAngle = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
const mix = (a: number, b: number, value: number) => a + (b - a) * value;

export function dealProgress(index: number, deal: number, count = WHEEL_COUNT) {
  const order = Math.min(Math.abs(wrapAngle(index * 360 / count)), 100) / 100;
  const progress = clamp01((deal - order * .6) / .4);
  return 1 - (1 - progress) ** 3;
}

export function wheelGeometry(width: number, height: number, lift: number) {
  const value = clamp01(lift);
  const radius = mix(580, 1010, value);
  const pivot = mix(500, 814, value);
  const scale = Math.max(.6, Math.min(width / 1220, height / 760)) * (1 + .14 * value);
  const grow = 1 + .35 * value;
  const originY = Math.max(20, height * .045) +
    (radius - pivot + CARD_HEIGHT * grow / 2) * scale * Math.cos(12 * value * Math.PI / 180);
  return {radius, pivot, grow, scale, originY,
    transform: `translateY(${60 - 10 * value}px) rotateX(${12 * value}deg) scale(${scale})`};
}

export function wheelCardPose(index: number, deal: number, lift: number, spin: number,
  geometry: Pick<ReturnType<typeof wheelGeometry>, 'radius' | 'pivot' | 'grow'>) {
  const progress = dealProgress(index, deal);
  const angle = wrapAngle(index * 360 / WHEEL_COUNT - spin - 28 * lift);
  const away = Math.abs(angle);
  const visible = progress > .0001 && away < 105;
  // Keep this order: move to pivot, rotate, push to rim, flip, grow.
  const transform = `translate3d(0, ${geometry.pivot.toFixed(3)}px, ${(-away * .5).toFixed(3)}px)` +
    ` rotateZ(${(angle + (1 - progress) * 70).toFixed(3)}deg)` +
    ` translate3d(0, ${(-geometry.radius * progress + (1 - progress) * 140).toFixed(3)}px, 0)` +
    ` rotateY(${((1 - progress) * 180).toFixed(3)}deg)` +
    ` scale(${((.7 + .3 * progress) * geometry.grow).toFixed(4)})`;
  return {angle, away, progress, visible, transform};
}

export const followAngle = (current: number, target: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 9));
export const decayVelocity = (velocity: number, dt: number) => velocity * Math.exp(-Math.max(0, dt) * 3.2);
export const releaseVelocity = (velocity: number, lastMove: number, now: number, reduced: boolean) =>
  reduced || now - lastMove > 80 ? 0 : velocity;
export const shouldPlayPreview = (lift: number, away: number, visible: boolean, reduced: boolean, paused: boolean) =>
  lift > .6 && away < 40 && visible && !reduced && !paused;
