import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNativeLoginCode } from "@/lib/native-auth-store";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:2rem;text-align:center">
        <h2>Session introuvable</h2>
        <p>Connecte-toi d'abord avec Google.</p>
      </body></html>`,
      { headers: { "content-type": "text/html" } },
    );
  }

  const code = createNativeLoginCode(
    session.user.id,
    session.user.email,
    session.user.name || session.user.email,
    session.user.image || "",
  );

  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:sans-serif;padding:2rem;text-align:center;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;margin:0}
  .code{font-size:3rem;font-weight:bold;letter-spacing:0.5rem;background:#27272a;padding:1rem 2rem;border-radius:1rem;margin:1.5rem 0;color:#10b981;font-family:monospace}
  .hint{color:#a1a1aa;font-size:0.875rem}
  p{margin:0.5rem 0}
</style>
</head>
<body>
  <p>✅ Connecté en tant que <strong>${session.user.email}</strong></p>
  <p>Retourne dans Gravio et saisis ce code :</p>
  <div class="code">${code}</div>
  <p class="hint">Ce code expire dans 5 minutes</p>
  <script>
    // Tentative d'ouverture auto via deep link
    setTimeout(function(){ window.location.href = "calistrack://login?code=${code}"; }, 2000);
  </script>
</body>
</html>`,
    { headers: { "content-type": "text/html" } },
  );
}
