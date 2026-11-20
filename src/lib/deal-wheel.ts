export const WHEEL_COUNT = 6;
export const WHEEL_SLOTS = 36;
export const WHEEL_STEP = 360 / WHEEL_SLOTS;
export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 320;
export const wrapAngle = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

export function wheelGeometry(width: number, height: number) {
  const radius = 1010, pivot = 814, grow = 1.35;
  const scale = Math.max(.6, Math.min(width / 1220, height / 760)) * 1.14;
  const originY = Math.max(20, height * .045) +
    (radius - pivot + CARD_HEIGHT * grow / 2) * scale;
  return {radius, pivot, grow, scale, originY,
    transform: `translateY(35px) scale(${scale})`};
}

export function wheelCardPose(index: number, spin: number,
  geometry: Pick<ReturnType<typeof wheelGeometry>, 'radius' | 'pivot' | 'grow'>) {
  const angle = wrapAngle(index * WHEEL_STEP - spin);
  const away = Math.abs(angle);
  const visible = away < 105;
  // A complete ring hides the wrap behind the viewport; source 1 follows source 6.
  const transform = `translate3d(0, ${geometry.pivot.toFixed(3)}px, ${(-away * .5).toFixed(3)}px)` +
    ` rotateZ(${angle.toFixed(3)}deg)` +
    ` translate3d(0, ${(-geometry.radius).toFixed(3)}px, 0)` +
    ` scale(${geometry.grow.toFixed(4)})`;
  return {angle, away, visible, transform};
}

export const followAngle = (current: number, target: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 9));
export const decayVelocity = (velocity: number, dt: number) => velocity * Math.exp(-Math.max(0, dt) * 3.2);
export const releaseVelocity = (velocity: number, lastMove: number, now: number, reduced: boolean) =>
  reduced || now - lastMove > 80 ? 0 : velocity;
export const shouldPlayPreview = (away: number, visible: boolean, reduced: boolean, paused: boolean) =>
  away < 40 && visible && !reduced && !paused;
