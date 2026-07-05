import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { verifyPassword } from "@/lib/password";

async function ensureDefaultCategories(userId: string) {
  const existing = await db.category.count({ where: { userId } });
  if (existing > 0) return;
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            checks: ["pkce", "state"],
            authorization: {
              params: {
                scope: "openid email profile",
                response_type: "code",
                prompt: "consent",
                access_type: "offline",
              },
            },
            httpOptions: {
              timeout: 10000,
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "google-demo",
      name: "Google (démo)",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Nom", type: "text" },
        image: { label: "Image", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        try {
          const email = credentials.email.toLowerCase().trim();
          const name = credentials.name || email.split("@")[0];
          const image =
            credentials.image ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5`;

          let user = await db.user.findUnique({ where: { email } });
          if (!user) {
            user = await db.user.create({ data: { email, name, image } });
          }
          await ensureDefaultCategories(user.id);

          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (e) {
          console.error("[auth] google-demo authorize error:", e instanceof Error ? e.message : e);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "email",
      name: "Email & mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const email = credentials.email.toLowerCase().trim();
          const user = await db.user.findUnique({ where: { email } });
          if (!user || !user.password) return null;
          if (!verifyPassword(credentials.password, user.password)) return null;
          await ensureDefaultCategories(user.id);
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (e) {
          console.error("[auth] authorize error:", e instanceof Error ? e.message : e);
          return null;
        }
      },
    }),
  ],
  events: {
    async error(message) {
      console.error("[auth] NextAuth error event:", JSON.stringify(message, (key, val) =>
        typeof val === "string" ? val.substring(0, 500) : val
      ));
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const email = user.email.toLowerCase().trim();
        const name = user.name || email.split("@")[0];
        const image =
          user.image ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5`;

        let dbUser = await db.user.findUnique({ where: { email } });
        if (!dbUser) {
          dbUser = await db.user.create({ data: { email, name, image } });
        }
        await ensureDefaultCategories(dbUser.id);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const email = user.email?.toLowerCase().trim();
        if (email) {
          try {
            const dbUser = await db.user.findUnique({ where: { email } });
            token.uid = dbUser?.id ?? user.id;
          } catch {
            token.uid = user.id;
          }
        }
      }
      if (token.uid) {
        try {
          const dbUser = await db.user.findUnique({ where: { id: token.uid as string } });
          if (dbUser) {
            token.name = dbUser.name ?? token.name;
            if (dbUser.image && !dbUser.image.startsWith("data:")) {
              token.image = dbUser.image;
            } else {
              delete token.image;
            }
          }
        } catch {
          // keep stale token values
        }
      }
      if (token.image && typeof token.image === "string" && token.image.startsWith("data:")) {
        delete token.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.name = token.name as string ?? session.user.name;
        if (token.uid) {
          try {
            const dbUser = await db.user.findUnique({ where: { id: token.uid as string } });
            if (dbUser?.image) session.user.image = dbUser.image;
          } catch {
            if (token.image) session.user.image = token.image as string;
          }
        } else if (token.image) {
          session.user.image = token.image as string;
        }
      }
      return session;
    },
  },
};
