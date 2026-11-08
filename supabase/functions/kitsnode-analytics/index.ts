import { createAnalyticsHandler, parseAnalyticsOrigins } from './handler.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const projectUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!projectUrl || !serviceKey) throw new Error('Service configuration unavailable');
Deno.serve(createAnalyticsHandler({
  projectUrl,
  serviceKey,
  // Release preparation only. Do not enable until retention and visitor notice
  // prerequisites are operational and the user approves collection activation.
  ingestEnabled: false,
  frontendOrigins: parseAnalyticsOrigins('https://heetae1120.github.io'),
  adminOrigins: parseAnalyticsOrigins('https://kitsnode-studio-owner.junho960809.chatgpt.site'),
}));
