import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_WIDTH,CARD_HEIGHT,WHEEL_COUNT,WHEEL_SLOTS,WHEEL_STEP,wheelGeometry,wheelCardPose,followAngle,decayVelocity,releaseVelocity,shouldPlayPreview} from '../src/lib/deal-wheel';
import {dealWheelCards,dealWheelSlots} from '../src/components/deal-wheel-data';

test('cards start fully spread with dense spacing and no entrance flip',()=>{
  const g=wheelGeometry(1400,760),pose=wheelCardPose(0,0,g);
  assert(pose.visible);assert.equal(pose.angle,0);
  assert(!pose.transform.includes('rotateY'));
  assert(2*g.radius*Math.sin(WHEEL_STEP*Math.PI/360)<CARD_WIDTH*g.grow);
});

test('one card pose preserves pivot, angle and radius order',()=>{
  const g=wheelGeometry(1400,760),pose=wheelCardPose(0,0,g);
  assert.match(pose.transform,/^translate3d\(0, .*\) rotateZ\(.*\) translate3d\(0, -1010\.000px, 0\) scale\(1\.3500\)$/);
});

test('six non-navigating sources repeat seamlessly and the wrap stays out of view',()=>{
  assert.equal(WHEEL_COUNT,6);assert.equal(dealWheelCards.length,6);assert.equal(dealWheelSlots.length,WHEEL_SLOTS);
  assert.equal(new Set(dealWheelCards.map(card=>card.label)).size,6);assert(dealWheelCards.every(card=>!('href' in card)));
  for(let i=0;i<WHEEL_SLOTS;i++)assert.equal(dealWheelSlots[i],dealWheelCards[i%6]);
  const g=wheelGeometry(1400,760);
  assert.equal(wheelCardPose(6,6*WHEEL_STEP,g).angle,0);
  for(let spin=0;spin<=720;spin++){
    const poses=dealWheelSlots.map((_,i)=>wheelCardPose(i,spin,g));
    assert(Math.min(...poses.map(p=>p.away))<=WHEEL_STEP/2+.001);
  }
  for(let i=0;i<WHEEL_SLOTS;i++){
    const before=wheelCardPose(i,179.99,g),after=wheelCardPose(i,180.01,g);
    if(Math.abs(before.angle-after.angle)>300)assert(!before.visible&&!after.visible);
  }
});

test('larger cards clear the top of short and narrow hero frames',()=>{
  for(const [width,height] of [[320,420],[390,540],[1024,460],[1474,748]]){
    const g=wheelGeometry(width,height);
    const top=g.originY+(g.pivot-g.radius-CARD_HEIGHT*g.grow/2)*g.scale+35;
    assert(top>=20);assert(Number.isFinite(g.scale));
  }
  assert(wheelGeometry(390,540).scale<wheelGeometry(1474,748).scale);
});

test('exponential following is independent of frame rate and never overshoots',()=>{
  const follow=(frames:number)=>{let value=0;for(let i=0;i<frames;i++)value=followAngle(value,90,1/frames);return value;};
  assert(Math.abs(follow(30)-follow(60))<1e-9);assert(follow(60)>89&&follow(60)<90);
});

test('flick velocity decays, and a paused pointer or reduced motion cancels release momentum',()=>{
  assert(decayVelocity(100,1)>0&&decayVelocity(100,1)<5);
  assert.equal(releaseVelocity(100,0,81,false),0);assert.equal(releaseVelocity(100,0,40,false),100);
  assert.equal(releaseVelocity(100,0,40,true),0);
});

test('video previews respect top visibility and motion preferences',()=>{
  assert(shouldPlayPreview(20,true,false,false));assert(!shouldPlayPreview(45,true,false,false));
  assert(!shouldPlayPreview(20,false,false,false));assert(!shouldPlayPreview(20,true,true,false));
  assert(!shouldPlayPreview(20,true,false,true));
});
