import { createAnalyticsHandler, parseAnalyticsOrigins } from './handler.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const projectUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!projectUrl || !serviceKey) throw new Error('Service configuration unavailable');
Deno.serve(createAnalyticsHandler({
  projectUrl,
  serviceKey,
  ingestEnabled: Deno.env.get('ANALYTICS_INGEST_ENABLED') === 'true',
  frontendOrigins: parseAnalyticsOrigins(Deno.env.get('ANALYTICS_FRONTEND_ORIGINS')),
  adminOrigins: parseAnalyticsOrigins(Deno.env.get('ANALYTICS_ADMIN_ORIGINS')),
}));
