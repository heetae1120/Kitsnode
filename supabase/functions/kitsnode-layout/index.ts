import { createHandler } from './handler.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const projectUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!projectUrl || !serviceKey) throw new Error('Service configuration unavailable');
Deno.serve(createHandler({projectUrl, serviceKey}));
