import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_HEIGHT,dealProgress,wheelGeometry,wheelCardPose,followAngle,decayVelocity,releaseVelocity,shouldPlayPreview} from '../src/lib/deal-wheel';

test('dealing begins at the top and reaches both neighbours symmetrically before the edges',()=>{
  assert(dealProgress(0,.15)>dealProgress(1,.15));
  assert(Math.abs(dealProgress(1,.35)-dealProgress(33,.35))<1e-10);
  assert.equal(dealProgress(9,.15),0);
  for(let index=0;index<34;index++){assert.equal(dealProgress(index,0),0);assert.equal(dealProgress(index,1),1);}
});
test('one card pose preserves pivot, angle, radius, flip and growth order',()=>{
  const geometry=wheelGeometry(1400,760,1),pose=wheelCardPose(0,1,1,0,geometry);
  assert.match(pose.transform,/^translate3d\(0, .*\) rotateZ\(.*\) translate3d\(0, -1010\.000px, 0\) rotateY\(0\.000deg\) scale\(1\.3500\)$/);
  assert.equal(pose.angle,-28);assert(pose.visible);
});
test('a circle wraps only where cards are hidden, never at the visible top seam',()=>{
  const geometry=wheelGeometry(1400,760,1);
  for(let index=0;index<34;index++){
    const before=wheelCardPose(index,1,1,179.99,geometry),after=wheelCardPose(index,1,1,180.01,geometry);
    if(Math.abs(before.angle-after.angle)>300)assert(!before.visible&&!after.visible);
  }
  assert(Math.abs(wheelCardPose(0,1,1,359.99,geometry).angle-wheelCardPose(0,1,1,360.01,geometry).angle)<.021);
});
test('the lifted wheel grows with its radius and fits the actual short or narrow hero frame',()=>{
  for(const [width,height] of [[320,420],[390,540],[1024,460],[1474,748]]){
    for(const lift of [0,.3,.7,1]){
      const g=wheelGeometry(width,height,lift);
      const top=g.originY+(g.pivot-g.radius-CARD_HEIGHT*g.grow/2)*g.scale*Math.cos(12*lift*Math.PI/180)+(60-10*lift);
      assert(top>=20);assert(Number.isFinite(g.scale));
    }
  }
  const start=wheelGeometry(1400,760,0),end=wheelGeometry(1400,760,1);
  assert(end.radius>start.radius*1.5);assert(end.pivot>start.pivot);assert(end.grow>start.grow);
  assert(wheelGeometry(390,540,1).scale<wheelGeometry(1474,748,1).scale);
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
test('video previews run only after the lift near the top and respect visibility and motion preferences',()=>{
  assert(shouldPlayPreview(.8,20,true,false,false));
  assert(!shouldPlayPreview(.5,20,true,false,false));assert(!shouldPlayPreview(.8,45,true,false,false));
  assert(!shouldPlayPreview(.8,20,false,false,false));assert(!shouldPlayPreview(.8,20,true,true,false));
  assert(!shouldPlayPreview(.8,20,true,false,true));
});
