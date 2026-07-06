// API v1 discovery endpoint — lists available resources.
// Also handles CORS preflight for external API consumers.

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    version: 1,
    resources: ['tasks', 'projects', 'time-entries', 'clients', 'reports', 'webhooks'],
    docs: 'https://taskcraft.aakasa.dev/docs/api',
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age':       '86400',
    },
  });
}
