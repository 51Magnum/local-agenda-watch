export const runtime="nodejs";
export async function GET(){return new Response("Image removed pending privacy verification",{status:410,headers:{"Cache-Control":"private, no-store, max-age=0","X-Robots-Tag":"noindex"}});}
