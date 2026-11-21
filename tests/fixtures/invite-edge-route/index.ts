// Runs only in an isolated local Edge Runtime, with no production credentials.
import {createExecutionProofHandler} from '../../../supabase/functions/kitsnode-ad-consent-proof/factory.mjs';
declare const Deno: {serve(handler: (request: Request) => Promise<Response>): void};
const authClient = {auth: {getUser: async () => ({data: null, error: true})}};
const serviceClient = {rpc: async () => ({data: null, error: true})};
Deno.serve(createExecutionProofHandler({authClient, serviceClient,
  extensionId: 'abcdefghijklmnopabcdefghijklmnop', consentVersion: 'test-v1', consentDigest: 'a'.repeat(64)}));
