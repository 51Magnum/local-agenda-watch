export const SOURCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export function sourceIsStale(lastSuccess?:string, now=Date.now()):boolean {
 const timestamp=lastSuccess?Date.parse(lastSuccess):NaN;
 return !Number.isFinite(timestamp)||now-timestamp>SOURCE_MAX_AGE_MS;
}
/** Safe diagnostics: never log request headers, credentials, or response bodies. */
export function sourceFailureCode(error:unknown):string {
 const message=error instanceof Error?error.message:"";
 const status=message.match(/HTTP (\d{3})/);return status?"HTTP "+status[1]:/challenge/i.test(message)?"challenge page":/timeout|abort/i.test(message)?"timeout":"fetch or parse failure";
}
