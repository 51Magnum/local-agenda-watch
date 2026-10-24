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
export const CASE_EVIDENCE: Record<string, { documentNames: string[]; address?: string; sourceUrl: string; reportUrl?: string; applicationCopy?: {headline:string;explanation:string;page:number;sourceDate:string}; visuals?: CaseVisual[] }> = {
  "SPP-00176-2026": {
    documentNames: ["Lake Lowell Estates · Council staff report, preliminary plat and landscape exhibits · Aug 3, 2026"],
    sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=9826",
    reportUrl: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=80b8084c-2c93-4738-8874-617d1c0ea8c8",
  },
  "ANN-00355-2026": {
    documentNames: ["Lake Lowell Estates · Council staff report, preliminary plat and landscape exhibits · Aug 3, 2026"],
    sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=9826",
    reportUrl: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=80b8084c-2c93-4738-8874-617d1c0ea8c8",
  },
  "ANN-00368-2026": {
    documentNames:["ANN-00368-2026_Americrete Annex_Staff Report PZ"],
    sourceUrl:"https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
    reportUrl:"https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=2dfe2f93-94c2-465e-b8aa-70833bc86e88",
    applicationCopy:{headline:"Annex 148.52 acres for existing concrete operations",explanation:"Americrete Land Holding and Triple Crown Development want to bring an existing concrete plant and gravel pit into Nampa with light-industrial zoning.",page:1,sourceDate:"2026-09-15"},
  },
  "ANN-00369-2026": {
    documentNames: ["3-1.a 17501 Northside Blvd Annexation and Zoning to IL_ANN-00369-2026_Northside Logistics Center_Staff Report PZ"],
    visuals: [
      { src: "/us/id/nampa/ann-00369-2026/zoning-map.webp", title: "Zoning map", alt: "Official zoning exhibit showing the Northside Logistics Center parcel marked Project Location on Northside Boulevard", caption: "The Project Location arrow marks the parcel in its surrounding zoning context.", width: 1855, height: 2400, sourcePage: 15 },
      { src: "/us/id/nampa/ann-00369-2026/future-land-use-map.webp", title: "Future land-use map", alt: "Official future land-use exhibit marking the Northside Logistics Center parcel on Northside Boulevard", caption: "The city's future land-use designations provide planning context; this map is not a development approval.", width: 1855, height: 2400, sourcePage: 16 },
    ],
    // Full address supplied by the site editor; street verified in this report.
    address: "17501 Northside Blvd, Nampa, ID 83687",
    sourceUrl: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
    reportUrl: "https://nampa.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId=cace2bcc-e1c6-4af8-b039-15eb63c021ab",
  },
};
