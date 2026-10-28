# ada-county onboarding QA

As of 2026-10-28T19:12:41.034Z. **Not ready for public launch. Admin-only.**

[Detailed JSON](ada-county-2026-10-28-dry-run.json) contains endpoint results, source URLs, skipped attachments and field review metadata. Candidate text is withheld; review it in authenticated admin.

## Collection

| Measure | Result |
| --- | --- |
| Projects retained | 34 |
| Projects before hearing scope | 87 |
| Excluded by hearing scope | 53 |
| Duplicate project records | 0 |
| Hearing-linked projects | 23 |
| Privacy-protected projects | 1 |
| Meetings | 6 |
| Case-bearing hearing items | 41 |
| Application match rate | 85.4% |
| Application geometry rate | 100.0% |
| Applications without geometry | 0 |
| Applications without address | 34 |
| Agenda items without matched geometry/address | 6 |

Recent applications plus older active records linked to collected hearings; undated active records retained

## Launch checks

- [x] hard-fact sources: Actual endpoint checks recorded; failures retained.
- [x] collection complete: Bounded collection completed
- [x] boundary: County coverage must exclude all incorporated cities
- [x] case matching: 35 of 41 hearing items match the application inventory
- [ ] AI sample: At least one source-backed AI sample is required; sensitive fields stay under review
- [ ] runtime download check: A Git-sourced Vercel-runtime document check is required separately
- [ ] recorded staging QA: Read-only collection report; not saved as durable staged QA and cannot authorize publication

## Endpoint health

| Host | OK | Blocked | Unavailable | Skipped |
| --- | ---: | ---: | ---: | ---: |

## Reviewed older heard projects

| Project | Present | Official hearing history |
| --- | --- | --- |
| [202600273](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202600273%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-15](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C10.15.2026-PZC_AGENDA.pdf&papp=DS_Agendas), [2026-09-10](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C09-September%5CPZC%5C9.10.2026-PZC_AGENDA.pdf&papp=DS_Agendas), [2026-08-13](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C08+-+August%5CPZC%5C8.13.2026_PZC_Agenda.pdf&papp=DS_Agendas) |
| [202601088](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202601088%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-14](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CBOCC%5C10.14.2026-BOCC_AGENDA.pdf&papp=DS_Agendas), [2026-09-10](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C09-September%5CPZC%5C9.10.2026-PZC_AGENDA.pdf&papp=DS_Agendas) |
| [202600638](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202600638%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-14](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CBOCC%5C10.14.2026-BOCC_AGENDA.pdf&papp=DS_Agendas), [2026-09-09](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C09-September%5CBOCC%5C9.9.2026-BOCC_AGENDA.pdf&papp=DS_Agendas), [2026-08-12](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C08+-+August%5CBOCC%5C8.12.2026_BOCC_Agenda.pdf&papp=DS_Agendas) |
| [202601398](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202601398%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-15](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C10.15.2026-PZC_AGENDA.pdf&papp=DS_Agendas) |
| [202601317](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202601317%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-15](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C10.15.2026-PZC_AGENDA.pdf&papp=DS_Agendas) |
| [202600819](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202600819%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-15](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C10.15.2026-PZC_AGENDA.pdf&papp=DS_Agendas), [2026-09-10](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C09-September%5CPZC%5C9.10.2026-PZC_AGENDA.pdf&papp=DS_Agendas), [2026-08-13](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C08+-+August%5CPZC%5C8.13.2026_PZC_Agenda.pdf&papp=DS_Agendas) |
| [202600934](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202600934%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-15](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C10.15.2026-PZC_AGENDA.pdf&papp=DS_Agendas), [2026-09-10](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C09-September%5CPZC%5C9.10.2026-PZC_AGENDA.pdf&papp=DS_Agendas) |
| [202103209](https://gisprodapi.adacounty.id.gov/arcgis/rest/services/DevelopmentServices/Planning_and_Building/MapServer/14/query?where=APPFileNum%3D%27202103209%27&outFields=*&returnGeometry=false&f=pjson) | yes | [2026-10-14](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CBOCC%5C10.14.2026-BOCC_AGENDA.pdf&papp=DS_Agendas), [2026-08-12](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C08+-+August%5CBOCC%5C8.12.2026_BOCC_Agenda.pdf&papp=DS_Agendas) |
| gisprodapi.adacounty.id.gov | 8 | 0 | 0 | 0 |
| apps.adacounty.id.gov | 7 | 0 | 0 | 0 |
| adacounty.id.gov | 1 | 0 | 0 | 0 |

Document-runtime checks: not verified. **Production runtime has not been tested.**

## AI samples and cost

Total measured sample spend, including image checks: **unavailable; durable ledger not read**. Hard ceiling: $1 per sample invocation; monthly and backfill caps also apply. Extraction-only cost is $0.000000.

Extraction tokens: 0. Page-image OCR and image-classifier spend is included in the durable budget ledger below; extraction token totals exclude those calls.

| Budget bucket | Spent USD | Reserved USD |
| --- | ---: | ---: |

Reserved cost from uncertain failed calls stays reserved until reconciled; do not sum the overlapping month/backfill/sample buckets.

Projected steady-state monthly cost: $0–$2. Planning estimate from onboarding brief, not measured spend; validate after one month.

## Next hearings and participation

- 2026-11-18: bocc, tentative schedule; agenda controls; [official meeting record](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).
- 2026-11-19: pzc, tentative schedule; agenda controls; [official meeting record](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).

## Map review checklist

- [ ] Manual visual check: Official boundary verified
- [ ] Manual visual check: County clipped below city layers
- [ ] Manual visual check: Distinct jurisdiction color
- [ ] Manual visual check: No location invented for unmapped applications
- [ ] Manual visual check: No public map, sitemap, search or email exposure

Boundary computation is covered by collection checks. This checklist is not a claim that a screenshot review was performed.

## Skipped and deferred documents

The JSON records 12 skips/deferred outcomes. Compiled packets and over-limit PDFs are excluded from AI. Remaining appendices are deferred, not declared empty.

## Source limitations

- Listings, GIS, participation endpoints and per-item documents checked from local ingestion and a Git-sourced Vercel preview on 2026-10-27. Production runtime is not verified.
- Filter AppDivision=PZ; do not backfill all historic building/zoning-certificate records.
- Close of business has no verified clock time; retain a date and qualified label, never invent 17:00.
- Use DS_Agendas only, never the general BOCCAgendas archive.
- Tentative hearing schedule is context; an actual agenda confirms a hearing.
- Application metadata has no address field. Do not manufacture an address from a parcel number.
