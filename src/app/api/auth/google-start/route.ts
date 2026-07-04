const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CALLBACK_URL = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/google-callback`
  : "https://gravio.onrender.com/api/auth/google-callback";

import { createOAuthState } from "@/lib/native-auth-store";

export async function GET() {
  const state = createOAuthState();

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

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;padding:2rem;text-align:center;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;margin:0}
  .spinner{width:32px;height:32px;border:3px solid #27272a;border-top-color:#10b981;border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  p{color:#a1a1aa;font-size:0.875rem;margin-top:1rem}
</style>
</head>
<body>
  <div class="spinner"></div>
  <p>Redirection vers Google...</p>
  <script>window.location.href = ${JSON.stringify(googleUrl)};</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}
