'use client';

import {createAdConnectionTransport} from '@/lib/ad-connection-transport.mjs';
import {AdConnectionPanel} from './ad-connection-panel';

const transport=createAdConnectionTransport({enabled:process.env.NEXT_PUBLIC_AD_CONNECTION_ENABLED==='true'});

export function ManualAdConnection() {
  return <div className="store-theme"><main className="ad-analysis"><AdConnectionPanel transport={transport} manualEntry/></main></div>;
}
