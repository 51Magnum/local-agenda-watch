# Kuna, Star, Middleton and Eagle

Official sources checked October 23, 2026. These adapters are independent of Boise's platform transition.

| Area | Initial source coverage | Geometry | Plan layer |
| --- | --- | --- | --- |
| Kuna | Active tracker cases, current/previous-year applications, 120 days of Council and P&Z agendas | City's public hearing polygons, expanded to each linked application number | City February 2026 FLUM, COMP_CODE, official renderer |
| Star | Public-hearing items in the latest three pages of Council agendas, limited to 120 days | Approximate parcel shapes only where an agenda explicitly identifies an Ada County parcel; other cases stay unmapped | No verified vector layer; do not substitute zoning or digitize a PDF silently |
| Middleton | Current public notice postings and application documents | No verified project polygons. Citywide ordinances are unpinned. Rosemary remains unmapped | No verified vector layer |
| Eagle | City development tracker and 120 days of Council/P&Z agendas | City's Active Applications polygons; each linked application number retains its outline | City GIS Future Land Use Revised 2025 (layer 105), NewCode, official renderer; label the version, do not imply all 2026 plan amendments are reflected |

## Official entry points

- Kuna: https://www.kunacity.id.gov/540/Public-Hearing-Level-Application-Tracker ; https://www.kunacity.id.gov/93/Agendas-Minutes ; https://www.kunacity.id.gov/106/GIS
- Star: https://www.staridaho.org/1305/Meetings-Agendas ; https://www.staridaho.org/1246/Public-Hearings
- Middleton: https://middleton.id.gov/public-hearing-notices . Its public Sanity endpoint is the same endpoint used by the city's page-content component. Only published notice sections are queried; no authenticated CMS access is used.
- Eagle: https://experience.arcgis.com/experience/db3c718974b842c5a13730261f2ab9ad ; https://www.cityofeagle.org/305/City-Agendas-Videos ; https://www.cityofeagle.org/1820/Plans-Maps

## Interpretation and refresh

Feeds refresh hourly through the existing case/map refresh path and persistent source cache. Official archive PDF URLs, SHA-256 hashes and extracted text are retained in the source snapshot. Unchanged bytes reuse extraction. Individual source failures retain prior data and display an unavailable notice. No AI calls or new decision-extraction publishing rules were introduced.

A hearing agenda is not an outcome. Consent findings, proposed motions, staff recommendations and requested continuances are not published as decisions. Kuna's explicit tracker Decision values and Eagle's Project Entitled status are structured official statuses; no decision date or approving body is inferred. Eagle NextHear timestamps have ambiguous timezone semantics: only the date is used, and times are supplied by matching calendars/agendas. Canceled Star meetings suppress original agenda rows for the same date.

Some agenda references lack official application numbers (e.g. a Middleton ordinance notice). ORD-### represents the published ordinance number; NOTICE-ROSEMARY is a stable local notice reference, not an invented city case number. Other linked IDs are preserved as the city publishes them.

## Remaining collection work

Star and Middleton are hearing-based initial coverage, not complete application inventories. Add their full application feeds when a reliable public endpoint is verified. Do not mark an unmapped application citywide, use an address point as a project boundary, or invent a location. Extend official parcel matches, current plan layers, and reviewed staff-report summaries/images separately. Existing AI review gates remain in effect.

Star source conflict: DA-26-03 appears under the Jackson property on September 15 and Moyle Junction on July 7. Preserve the latest named reference, withhold conflicting associations, and retain the original agendas as evidence; do not use that shared ID to rename or group other project references.
