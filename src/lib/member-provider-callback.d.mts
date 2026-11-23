export function createProviderCallbackCapture(auth: {onAuthStateChange: Function}, options?: {ttlMs?:number}): {take(session: unknown): string|null; dispose():void};
