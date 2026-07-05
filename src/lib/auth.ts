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
        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;
        if (!verifyPassword(credentials.password, user.password)) return null;
        await ensureDefaultCategories(user.id);
        return { id: user.id, email: user.email, name: user.name, image: user.image };
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
    async jwt({ token, user, account }) {
      if (user) {
        console.log("[auth] jwt callback", { provider: account?.provider, email: user.email, hasId: !!user.id });
        const email = user.email?.toLowerCase().trim();
        if (email) {
          try {
            const dbUser = await db.user.findUnique({ where: { email } });
            if (dbUser) {
              token.uid = dbUser.id;
              if (dbUser.image && !dbUser.image.startsWith("data:")) {
                token.image = dbUser.image;
              }
              console.log("[auth] jwt: found DB user", { uid: token.uid });
            } else {
              token.uid = user.id;
              console.log("[auth] jwt: no DB user, using provider id", { uid: token.uid });
            }
          } catch (e) {
            console.error("[auth] jwt DB lookup failed", e instanceof Error ? e.message : e);
            token.uid = user.id;
          }
        }
        if (user.image && !user.image.startsWith("data:")) token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        if (token.image) session.user.image = token.image as string;
        console.log("[auth] session created", { uid: session.user.id });
      }
      return session;
    },
  },
};
