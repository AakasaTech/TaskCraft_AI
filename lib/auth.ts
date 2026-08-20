import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "../auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { slugify } from "@/lib/utils";

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: {},
      password: {},
    },
    async authorize(credentials) {
      const email = credentials?.email;
      const password = credentials?.password;
      if (typeof email !== "string" || typeof password !== "string") return null;

      const normalizedEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      if (user.bannedUntil && user.bannedUntil > new Date()) return null;

      return { id: user.id, email: user.email };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (user.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { bannedUntil: true } });
        if (dbUser?.bannedUntil && dbUser.bannedUntil > new Date()) return false;
      }

      if (account?.provider === "google" && user.id) {
        const existingProfile = await prisma.profile.findUnique({ where: { userId: user.id } });
        if (!existingProfile) {
          const fullName = user.name ?? user.email?.split("@")[0] ?? "User";
          const orgName = `${fullName}'s Workspace`;
          const slug = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 7)}`;

          await prisma.$transaction(async (tx) => {
            const profile = await tx.profile.create({
              data: {
                userId: user.id!,
                email: user.email ?? "",
                fullName,
                avatarUrl: user.image ?? null,
                plan: "free",
              },
            });

            const workspace = await tx.workspace.create({
              data: {
                name: orgName,
                slug,
                ownerId: profile.id,
              },
            });

            await tx.workspaceMember.create({
              data: {
                workspaceId: workspace.id,
                userId: profile.id,
                role: "owner",
              },
            });

            await tx.subscription.create({
              data: {
                userId: user.id!,
                planId: "free",
                status: "active",
              },
            });
          });
        }
      }
      return true;
    },
  },
});
