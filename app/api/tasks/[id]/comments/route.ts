import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const comments = await prisma.taskComment.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { fullName: true, avatarUrl: true } } },
  });

  return NextResponse.json({
    data: comments.map((c) => ({
      id:         c.id,
      task_id:    c.taskId,
      user_id:    c.userId,
      content:    c.content,
      is_edited:  c.isEdited,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
      profiles:   { full_name: c.user.fullName, avatar_url: c.user.avatarUrl },
    })),
  });
}
