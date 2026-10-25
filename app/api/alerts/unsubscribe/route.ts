import { unsubscribeAlert } from "@/lib/alerts";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[\w-]{43}$/.test(token))
    return new Response("Invalid link", { status: 400 });
  return new Response(
    '<!doctype html><title>Unsubscribe</title><h1>Stop Local Agenda Watch emails</h1><form method="post"><button>Unsubscribe from all alerts</button></form>',
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
  await unsubscribeAlert(new URL(request.url).searchParams.get("token") ?? "");
  return new Response("You are unsubscribed from all alerts.", {
    headers: { "Cache-Control": "no-store" },
  });
}
