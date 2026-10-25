import { parseWatchTarget, subscribeAlert } from "@/lib/alerts";
import { sameOrigin } from "@/lib/timeline/auth";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!sameOrigin(request))
    return Response.json(
      { error: "Submit from this site." },
      { status: 403, headers },
    );
  const text = await request.text();
  if (text.length > 4000)
    return Response.json(
      { error: "Request too long" },
      { status: 400, headers },
    );
  let data, target;
  try {
    data = JSON.parse(text);
    if (data.website) return Response.json({ ok: true }, { headers });
    target = parseWatchTarget(data.target);
    if (
      typeof data.email !== "string" ||
      data.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    )
      throw Error("Enter a valid email");
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid watch" },
      { status: 400, headers },
    );
  }
  try {
    const result = await subscribeAlert(
      data.email,
      target,
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown",
      new URL(request.url).origin,
    );
    return Response.json(
      result.limited
        ? { error: "Too many requests. Try again later." }
        : {
            ok: true,
            message:
              "Check your email to confirm. Alerts start only after confirmation.",
          },
      { status: result.limited ? 429 : 201, headers },
    );
  } catch {
    return Response.json(
      { error: "Email alerts are not available yet. Please try again later." },
      { status: 503, headers },
    );
  }
}
