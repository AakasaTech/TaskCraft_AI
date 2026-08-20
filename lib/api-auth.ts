import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
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
  if (!key) return null;

  const hash = createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id:          true,
      workspaceId: true,
      userId:      true,
      scopes:      true,
      revokedAt:   true,
      expiresAt:   true,
    },
  });

  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Fire-and-forget last_used_at update
  void prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data:  { lastUsedAt: new Date() },
    })
    .catch(console.error);

  return {
    userId:      apiKey.userId,
    workspaceId: apiKey.workspaceId,
    scopes:      apiKey.scopes as ApiScope[],
    keyId:       apiKey.id,
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
