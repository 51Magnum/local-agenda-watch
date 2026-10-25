import { confirmAlert } from "@/lib/alerts";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[\w-]{43}$/.test(token))
    return new Response("Invalid confirmation link", { status: 400 });
  return new Response(
    '<!doctype html><title>Confirm project alerts</title><h1>Confirm Local Agenda Watch alerts</h1><p>Send daily updates when your watched project or place changes.</p><form method="post"><input type="hidden" name="token" value="' +
      token +
      '"><button>Confirm alerts</button></form>',
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
export async function POST(request: Request) {
  const token = String((await request.formData()).get("token") ?? "");
  const ok = await confirmAlert(token);
  return new Response(
    ok
      ? "Alerts confirmed. You can close this page."
      : "This link expired or is no longer active.",
    { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } },
  );
}
