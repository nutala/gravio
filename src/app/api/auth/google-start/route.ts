import { createOAuthState } from "@/lib/native-auth-store";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CALLBACK_URL = process.env.NEXTAUTH_URL
  ? `${process.env.NEXTAUTH_URL}/api/auth/google-callback`
  : "https://gravio.onrender.com/api/auth/google-callback";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "native";
  const { state } = createOAuthState(source);

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

  // 302 redirect — no JS needed, works in any browser
  return new Response(null, {
    status: 302,
    headers: { location: googleUrl },
  });
}
