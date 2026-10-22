export type CaseVisual = {
  src: string;
  title: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  sourcePage: number;
};

/** Verified public document metadata remains available when EnerGov is down. */
export const CASE_EVIDENCE: Record<string, { documentNames: string[]; address?: string; sourceUrl: string; reportUrl?: string; visuals?: CaseVisual[] }> = {
  "ANN-00369-2026": {
    documentNames: ["3-1.a 17501 Northside Blvd Annexation and Zoning to IL_ANN-00369-2026_Northside Logistics Center_Staff Report PZ"],
    visuals: [
      { src: "/nampa/ann-00369-2026/zoning-map.webp", title: "Zoning map", alt: "Official zoning exhibit showing the Northside Logistics Center parcel marked Project Location on Northside Boulevard", caption: "The Project Location arrow marks the parcel in its surrounding zoning context.", width: 1855, height: 2400, sourcePage: 15 },
      { src: "/nampa/ann-00369-2026/future-land-use-map.webp", title: "Future land-use map", alt: "Official future land-use exhibit marking the Northside Logistics Center parcel on Northside Boulevard", caption: "The city's future land-use designations provide planning context; this map is not a development approval.", width: 1855, height: 2400, sourcePage: 16 },
    ],
    // Full address supplied by the site editor; street verified in this report.
    address: "17501 Northside Blvd, Nampa, ID 83687",
    sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
    reportUrl: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=cace2bcc-e1c6-4af8-b039-15eb63c021ab",
  },
};
