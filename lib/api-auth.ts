import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiScope } from '@/lib/types';

export interface ApiContext {
  userId:      string;
  workspaceId: string;
  scopes:      ApiScope[];
  keyId:       string;
}

export async function authenticateApiKey(req: Request): Promise<ApiContext | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const key = authHeader.slice(7).trim();
  if (!key)  return null;

  const hash  = createHash('sha256').update(key).digest('hex');
  const admin = createAdminClient();

  const { data } = await admin
    .from('api_keys')
    .select('id, workspace_id, user_id, scopes, revoked_at, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!data)                                                       return null;
  if (data.revoked_at)                                             return null;
  if (data.expires_at && new Date(data.expires_at) < new Date())  return null;

  // Fire-and-forget last_used_at update
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(console.error);

  return {
    userId:      data.user_id,
    workspaceId: data.workspace_id,
    scopes:      data.scopes as ApiScope[],
    keyId:       data.id,
  };
}

export function hasScope(ctx: ApiContext, required: ApiScope): boolean {
  if (ctx.scopes.includes('admin')) return true;
  if (required === 'write' && ctx.scopes.includes('write')) return true;
  return ctx.scopes.includes(required);
}

export function generateRawKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex');
  const key    = `tc_live_${random}`;
  const hash   = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 16);
  return { key, hash, prefix };
}
