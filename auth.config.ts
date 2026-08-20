import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config: no Prisma or pg imports.
 * Used by middleware.ts on the Edge runtime.
 * Session strategy is JWT so auth() only verifies signed cookies.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { auth } = NextAuth(authConfig);
