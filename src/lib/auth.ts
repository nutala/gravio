import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

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
            authorization: {
              params: { prompt: "select_account", access_type: "offline", response_type: "code" },
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
  ],
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
          const dbUser = await db.user.findUnique({ where: { email } });
          if (dbUser) {
            token.uid = dbUser.id;
          } else {
            token.uid = user.id;
          }
        }
        if (user.image) token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        if (token.image) session.user.image = token.image as string;
      }
      return session;
    },
  },
};
