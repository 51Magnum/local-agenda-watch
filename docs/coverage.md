# Coverage and location routing

`lib/areas/registry.ts` owns the country/state/area identity, coverage status,
boundary, timezone, decision bodies, participation rules and source URLs.
`lib/maps/jurisdictions.ts` supplies the source-specific map adapter for live areas.
`lib/areas/server.ts` connects live areas to their page/data adapters.

Nampa is the only live adapter. Its coverage boundary combines the city's published
city limits and area of impact; the source links and boundary label are explicit
in the registry. Canyon County uses the Census county boundary and remains coming
soon, with no case or meeting sources enabled.

Canonical paths are `/{country}/{state}/{area}`. The proxy sends legacy `/nampa`
paths to `/us/id/nampa` with HTTP 301 and preserves query strings. Canonical image
paths rewrite internally to existing public files. Saved watches normalize legacy
links when read, preserving residents' selections.

Homepage street searches naming a live city try its address points first, with
a 700 ms cutoff, before falling back to Census. City-only searches use the Census
place layer. Results are cached in the browser session for 24 hours, with at most 40
entries. Ordinary searches are not written to the application database. Boundary
matching selects live areas only, preferring a city over an overlapping county.
Searches and optional browser geolocation open the canonical map with `lat`, `lng`
and `nearby=1`, plus the matched address in `q` when available. Shared URLs contain
that address and the selected coordinates.

Optional `flumCompatibility` entries map a designation to supported zoning codes,
with an official source for each category and a jurisdiction-specific code pattern.
The key facts compare only those districts, leave mixed sites unclassified, and
show the designation alone when no mapping or requested code is available. A match
does not establish that every other comprehensive-plan policy has been satisfied.

Coverage requests and follow interest are submitted separately. With the existing
server-only `DATABASE_URL`, the app creates `law_coverage_requests` in Neon on the
first submission. It stores the request kind, area requested, optional coordinates,
optional email and timestamp. It sends no alerts. Development without a database
uses ignored `.data/coverage-requests.json`; Vercel requires the database and does
not fall back to an ephemeral file.

To add coverage, first register the boundary as coming soon. Add and verify the
case, agenda and map adapters before switching its status to live. Country/state
indexes and coverage links derive from registry entries. Additional countries can
use the same route and boundary model; non-US geocoding needs its own provider.
