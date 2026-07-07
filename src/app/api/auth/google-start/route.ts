import { createOAuthState } from "@/lib/native-auth-store";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const source = reqUrl.searchParams.get("source") || "native";
  const { state } = createOAuthState(source);

  // Use the origin explicitly passed by the client, falling back to the
  // request origin.  On Render.com the request origin can be an internal
  // proxy URL, so the client-side origin (window.location.origin) is
  // authoritative.
  const origin = reqUrl.searchParams.get("origin") || reqUrl.origin;
  const CALLBACK_URL = `${origin}/api/auth/google-callback`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // HTML page with meta refresh — works even if 302 is blocked by SW / CDN / extensions
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${googleUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")}">
  <title>Redirection vers Google...</title>
</head>
<body>
  <p>Redirection vers Google...</p>
  <a href="${googleUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")}">Clique ici si rien ne se passe</a>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
