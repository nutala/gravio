import { NextRequest, NextResponse } from "next/server";
import { consumeNativeLoginCode } from "@/lib/native-auth-store";
import { encode } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code requis" }, { status: 400 });
  }

  const entry = consumeNativeLoginCode(code);
  if (!entry) {
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Serveur mal configuré" }, { status: 500 });
  }

  // Create a JWT token matching NextAuth's format
const token = await encode({
      secret,
      token: {
        uid: entry.uid,
        sub: entry.uid,
        email: entry.email,
        name: entry.name,
        image: entry.image && !entry.image.startsWith("data:") ? entry.image : null,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      },
    });

  const response = NextResponse.json({ success: true, email: entry.email, name: entry.name });

  // Set the NextAuth session cookie — must match NextAuth's own cookie name.
  // On HTTPS NextAuth uses __Secure-next-auth.session-token; on HTTP it uses
  // next-auth.session-token.  Using the wrong name makes the session invisible
  // on the next request.
  const isSecure = req.url?.startsWith("https");
  const cookieName = isSecure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });

  return response;
}
