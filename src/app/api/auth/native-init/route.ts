export async function GET() {
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
  <script>
    (async function(){
      try {
        const r = await fetch("/api/auth/csrf");
        const d = await r.json();
        var form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/auth/signin/google";
        form.style.display = "none";
        var inp = document.createElement("input");
        inp.name = "csrfToken";
        inp.value = d.csrfToken;
        form.appendChild(inp);
        var inp2 = document.createElement("input");
        inp2.name = "callbackUrl";
        inp2.value = "/api/auth/native-callback";
        form.appendChild(inp2);
        document.body.appendChild(form);
        form.submit();
      } catch(e) {
        document.body.innerHTML = '<h2 style="color:#ef4444">Erreur</h2><p style="color:#a1a1aa">Impossible de contacter le serveur.</p>';
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html" },
  });
}
