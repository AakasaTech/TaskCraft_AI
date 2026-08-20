import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Profile, Workspace, WorkspaceMember } from "@/lib/generated/prisma/client";

export interface CurrentUser {
  id: string; // user.id
  email: string;
  profile: Profile;
  workspace: Workspace;
  membership: WorkspaceMember;
}

/**
 * Returns the current authenticated user with their profile and active workspace.
 * Safe to call from Server Components, Server Actions, and API route handlers.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return null;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        workspaceMemberships: {
          include: { workspace: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!profile || profile.workspaceMemberships.length === 0) return null;

    const primaryMembership = profile.workspaceMemberships[0];

    return {
      id: userId,
      email: session.user?.email ?? profile.email,
      profile,
      workspace: primaryMembership.workspace,
      membership: primaryMembership,
    };
  } catch {
    return null;
  }
}

/**
 * Requires authentication. Redirects to /login if not authenticated.
 * Returns the non-null CurrentUser.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  return currentUser;
}

/**
 * Lightweight helper returning only user id and email from the JWT session
 * without triggering database queries.
 */
export async function getAuthUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies that the current user has access to the specified workspace
 * and optionally satisfies a minimum role.
 */
const ROLE_RANKS: Record<string, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1,
};

export async function requireWorkspaceAccess(
  workspaceId: string,
  minRole: "owner" | "admin" | "manager" | "member" | "viewer" = "viewer"
) {
  const user = await requireAuth();

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.profile.id,
      },
    },
    include: { workspace: true },
  });

  if (!membership) {
    redirect("/dashboard");
  }

  const userRank = ROLE_RANKS[membership.role] ?? 0;
  const reqRank = ROLE_RANKS[minRole] ?? 0;

  if (userRank < reqRank) {
    redirect("/dashboard");
  }

  return {
    ...user,
    workspace: membership.workspace,
    membership,
  };
}
