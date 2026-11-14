import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberConsentGate} from '../src/components/store/member-consent-gate';

test('requires separate unchecked acknowledgements and uses the site base path',()=>{
  const html=renderToStaticMarkup(<MemberConsentGate basePath="/Kitsnode" accept={async()=>({ok:false})} signOut={async()=>{}} onAccepted={()=>{}}/>);
  assert.match(html,/href="\/Kitsnode\/terms\/"/);
  assert.match(html,/href="\/Kitsnode\/privacy\/"/);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,2);
  assert.doesNotMatch(html,/checked=""/);
  assert.match(html,/disabled="">확인하고 계속하기/);
});
