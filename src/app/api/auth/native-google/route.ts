import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { encode } from "next-auth/jwt";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: number;
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token verification failed: ${res.status} ${text}`);
  }
  const payload = await res.json();
  if (payload.aud !== CLIENT_ID) {
    throw new Error("Token audience mismatch");
  }
  return payload as GoogleTokenPayload;
}

async function ensureDefaultCategories(userId: string) {
  const existing = await db.category.count({ where: { userId } });
  if (existing > 0) return;
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "idToken requis" }, { status: 400 });
    }

    const payload = await verifyGoogleToken(idToken);
    if (!payload.email) {
      return NextResponse.json({ error: "Email requis dans le token" }, { status: 400 });
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || email.split("@")[0];
    const image =
      payload.picture ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5`;

    let dbUser = await db.user.findUnique({ where: { email } });
    if (!dbUser) {
      dbUser = await db.user.create({ data: { email, name, image } });
    }
    await ensureDefaultCategories(dbUser.id);

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Serveur mal configuré" }, { status: 500 });
    }

    const token = await encode({
      secret,
      token: {
        uid: dbUser.id,
        sub: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image && !dbUser.image.startsWith("data:") ? dbUser.image : (image.startsWith("data:") ? null : image),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      },
    });

    const response = NextResponse.json({
      success: true,
      email: dbUser.email,
      name: dbUser.name,
    });

    const isSecure = req.url?.startsWith("https");
    response.cookies.set("next-auth.session-token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });

    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("[native-google]", message);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
