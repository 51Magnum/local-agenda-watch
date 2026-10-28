# ada-county onboarding QA

As of 2026-10-27T17:18:09.104Z. **Not ready for public launch. Admin-only.**

[Detailed JSON](ada-county-2026-10-27.json) contains every endpoint result, source URL, skipped attachment and extracted field.

## Collection

| Measure | Result |
| --- | --- |
| Applications retained | 110 |
| Meetings | 6 |
| Case-bearing hearing items | 92 |
| Application match rate | 5.4% |
| Application geometry rate | 100.0% |
| Applications with no location | 0 |

Recent applications plus older active records linked to collected hearings; undated active records retained

## Launch checks

- [x] hard-fact sources: Actual endpoint checks recorded; failures retained.
- [x] collection complete: Bounded collection completed
- [x] boundary: County coverage must exclude all incorporated cities
- [ ] case matching: 5 of 92 hearing items match the application inventory
- [x] AI sample: At least one source-backed AI sample is required; sensitive fields stay under review
- [x] runtime download check: A Git-sourced Vercel-runtime document check is required separately

## Endpoint health

| Host | OK | Blocked | Unavailable | Skipped |
| --- | ---: | ---: | ---: | ---: |
| gisprodapi.adacounty.id.gov | 16 | 0 | 0 | 0 |
| apps.adacounty.id.gov | 8 | 0 | 0 | 0 |
| adacounty.id.gov | 2 | 0 | 0 | 0 |
| services2.arcgis.com | 1 | 0 | 0 | 0 |

Document-runtime checks: preview, Git commit b5fae7aec0fc24a0abb9d6053c410ff5b221f417. **Production runtime has not been tested.**
- [Official document](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C08+-+August%5CPZC%5C7-PZC-201601258-DA-DM-D-STAFF_REPORT.pdf&papp=DS_Agendas): ok, HTTP 200

## AI samples and cost

Total measured sample spend, including image checks: **$0.028287**. Hard ceiling: $1 per sample invocation; monthly and backfill caps also apply. Extraction-only cost is $0.028287.

Extraction tokens: 45080. Page-image OCR and image-classifier spend is included in the durable budget ledger below; extraction token totals exclude those calls.

| Budget bucket | Spent USD | Reserved USD |
| --- | ---: | ---: |
| backfill | 0.028287 | 0.000000 |
| month:2026-10 | 0.028287 | 0.000000 |
| sample:9ffa6001-b025-4b51-8c6c-b89be1e315c5 | 0.028287 | 0.000000 |

Reserved cost from uncertain failed calls stays reserved until reconciled; do not sum the overlapping month/backfill/sample buckets.

### 202601398-CU-MSP

[Official report](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C05-PZC-202601398-CU-MSP-STAFF_REPORT.pdf&papp=DS_Agendas); 9 inspected pages; 9783 extraction tokens; $0.005950 extraction cost. AI-generated candidates require their recorded review status.

| Field | Value | Physical page | Status |
| --- | --- | ---: | --- |
| acres | 10.77 acres | 1 | auto_published |
| staffRecommendation | Staff recommends approval of the renewal of the contractor's yard Conditional Use and Master Site Plan as it complies with Ada County Code. | 6 | auto_published |
| applicantCompany | Gary A. Lee | 1 | auto_published |
| pzHearingDate | 2026-10-15 | 1 | auto_published |

### 202601317-CU-MSP

[Official report](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C06-PZC-202601317-CU-MSP-STAFF_REPORT.pdf&papp=DS_Agendas); 11 inspected pages; 8229 extraction tokens; $0.005213 extraction cost. AI-generated candidates require their recorded review status.

| Field | Value | Physical page | Status |
| --- | --- | ---: | --- |
| popupHeadline | Conditional Use and Master Site Plan for 40-acre gravel pit operation | 1 | auto_published |
| densityContext | The proposed gravel pit meets the purpose of the Rural Preservation District with minimal impact on prime farmland and no extension of public services required. | 3 | auto_published |
| constructionTiming | Extraction period proposed for twenty (20) years. | 2 | auto_published |
| applicantCompany | Quality Sand & Gravel Inc | 1 | auto_published |
| pzHearingDate | 2026-10-15 | 1 | auto_published |

### 202601395-CU-MSP-ALT

[Official report](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CPZC%5C07-PZC-202601395-CU-MSP-ALT-STAFf_REPORT.pdf&papp=DS_Agendas); 8 inspected pages; 8112 extraction tokens; $0.005348 extraction cost. AI-generated candidates require their recorded review status.

| Field | Value | Physical page | Status |
| --- | --- | ---: | --- |
| popupHeadline | Renewal of contractor's yard and shop operation on 9.271 acres in Rural Urban Transition zone | 1 | auto_published |
| acres | 9.271 acres | 1 | auto_published |
| staffRecommendation | Recommend approval as set out in the Findings of Fact and Conclusions of Law attached hereto | 5 | auto_published |
| trafficSummary | Ada County Highway District has no comments or required improvements for this application. | 5 | auto_published |
| densityContext | The property is in a transitional district with the contractor’s yard use allowed for up to five years or until annexation. The use is consistent with the Rural Urban Transition district's purpose as a transitional use. | 4 | auto_published |
| applicantCompany | Risa Roe | 1 | auto_published |
| pzHearingDate | 2026-10-15 | 1 | auto_published |

### 202600638-ZC-DA-S-V

[Official report](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CBOCC%5C01-BOCC-202600638-ZC-DA-S-V-STAFF_REPORT.pdf&papp=DS_Agendas); 6 inspected pages; 8659 extraction tokens; $0.005589 extraction cost. AI-generated candidates require their recorded review status.

| Field | Value | Physical page | Status |
| --- | --- | ---: | --- |
| popupHeadline | Subdivision into two lots with zoning change and variance for undersized lot | 1 | auto_published |
| acres | 9.36 acres | 1 | auto_published |
| units | 2 lots | 2 | auto_published |
| zoningRequested | Rural-Urban Transition (RUT) District | 1 | auto_published |
| staffRecommendation | recommend approval | 4 | auto_published |
| applicantCompany | Ackerman-Estvold | 1 | auto_published |
| councilHearingDate | 2026-10-14 | 1 | auto_published |

### 202601258-DA-DM

[Official report](https://apps.adacounty.id.gov/AdaFileBrowse/Home/OpenDocument?doc=%5C2026%5C10-October%5CBOCC%5C02-BOCC-202601258-DA-DM-STAFF_REPORT.pdf&papp=DS_Agendas); 11 inspected pages; 10297 extraction tokens; $0.006188 extraction cost. AI-generated candidates require their recorded review status.

| Field | Value | Physical page | Status |
| --- | --- | ---: | --- |
| popupHeadline | Dry Creek Ranch Planned Community periodic evaluation and development update | 1 | auto_published |
| acres | 1,414 acres | 2 | auto_published |

Projected steady-state monthly cost: $0–$2. Planning estimate from onboarding brief, not measured spend; validate after one month.

## Next hearings and participation

- 2026-11-18: bocc, tentative schedule; agenda controls; [official meeting record](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).
  - written: 2026-11-12, Close of business (clock time not verified); [rule source](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).
  - remote: 2026-11-16, Registration date; confirm the cutoff time; [rule source](https://adacounty.id.gov/developmentservices/public-hearing-testimony-sign-up/).
- 2026-11-19: pzc, tentative schedule; agenda controls; [official meeting record](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).
  - written: 2026-11-12, Close of business (clock time not verified); [rule source](https://adacounty.id.gov/developmentservices/community-planning-division/public-hearings-agendas/).
  - remote: 2026-11-16, Registration date; confirm the cutoff time; [rule source](https://adacounty.id.gov/developmentservices/public-hearing-testimony-sign-up/).

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
- Historical hearing cases may be absent from the active application feed. Missing matches remain explicit; no location or case relationship is inferred. Older hearing-linked active records are retained. A targeted historical-record lookup is not implemented.
