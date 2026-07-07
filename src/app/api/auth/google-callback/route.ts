import { consumeOAuthState, createNativeLoginCode } from "@/lib/native-auth-store";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

async function ensureDefaultCategories(userId: string) {
  const existing = await db.category.count({ where: { userId } });
  if (existing > 0) return;
  await db.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
  });
}

interface GoogleUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

async function exchangeCode(code: string, callbackUrl: string): Promise<GoogleUser> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
  }

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error(`User info failed: ${userRes.status}`);
  }

  return userRes.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code || !stateParam) {
    return errorPage("Paramètres manquants");
  }

  const { valid, source, origin } = consumeOAuthState(stateParam);
  if (!valid) {
    return errorPage("État invalide ou expiré");
  }

  // Use the origin stored in the OAuth state (set by google-start from
  // the client-side origin) instead of url.origin, because on Render.com
  // the request origin may be an internal proxy URL.
  const callbackOrigin = origin || url.origin;
  const callbackUrl = `${callbackOrigin}/api/auth/google-callback`;

  let googleUser: GoogleUser;
  try {
    googleUser = await exchangeCode(code, callbackUrl);
  } catch (e) {
    return errorPage(e instanceof Error ? e.message : "Erreur d'échange");
  }

  if (!googleUser.email) {
    return errorPage("Email Google requis");
  }

  const email = googleUser.email.toLowerCase().trim();
  const name = googleUser.name || email.split("@")[0];
  const image =
    googleUser.picture ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4f46e5`;

  let dbUser = await db.user.findUnique({ where: { email } });
  if (!dbUser) {
    dbUser = await db.user.create({ data: { email, name, image } });
  }
  await ensureDefaultCategories(dbUser.id);

  if (source === "web") {
    // Auto-login for web: create JWT session and redirect
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return errorPage("Serveur mal configuré");

    const token = await encode({
      secret,
      token: {
        uid: dbUser.id,
        sub: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || name,
        image: dbUser.image && !dbUser.image.startsWith("data:") ? dbUser.image : (image.startsWith("data:") ? null : image),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      },
    });

    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("next-auth.session-token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return response;
  }

  // Native: show login code for copy-paste
  const loginCode = createNativeLoginCode(dbUser.id, dbUser.email, dbUser.name || name, dbUser.image || image);

  const codeHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;padding:2rem;text-align:center;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;margin:0}
  .code{font-size:3rem;font-weight:bold;letter-spacing:0.5rem;background:#27272a;padding:1rem 2rem;border-radius:1rem;margin:1.5rem 0;color:#10b981;font-family:monospace}
  .hint{color:#a1a1aa;font-size:0.875rem}
  p{margin:0.5rem 0}
</style>
</head>
<body>
  <p>✅ Connecté en tant que <strong>${email}</strong></p>
  <p>Retourne dans Gravio et saisis ce code :</p>
  <div class="code">${loginCode}</div>
  <p class="hint">Ce code expire dans 5 minutes</p>
  <script>
    setTimeout(function(){ window.location.href = "calistrack://login?code=${loginCode}"; }, 2000);
  </script>
</body>
</html>`;

  return new Response(codeHtml, {
    headers: { "content-type": "text/html" },
  });
}

function errorPage(msg: string) {
  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;padding:2rem;text-align:center;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;margin:0}
  h2{color:#ef4444}
  p{color:#a1a1aa;font-size:0.875rem}
</style>
</head>
<body>
  <h2>Erreur</h2>
  <p>${msg}</p>
  <p>Retourne dans Gravio et réessaie.</p>
</body>
</html>`,
    { headers: { "content-type": "text/html" } },
  );
}
