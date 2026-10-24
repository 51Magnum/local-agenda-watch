import{areaPath}from"@/lib/areas/registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CaseProjectPage from "@/app/components/case-project-page";
import NorthsideProjectPage from "@/app/nampa/_components/northside-project-page";
import { getCaseRecord } from "@/lib/case-record";
import { caseDisplayTitle, caseMetaDescription, getCaseNextHearing } from "@/lib/case-details";
import { SITE_ORIGIN } from "@/lib/site-config";
type RouteParams = { planNumber: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { planNumber } = await params;
  const record = await getCaseRecord(planNumber);
  if (!record) return { title: planNumber, robots: { index: false } };
  const { hearing, plan, attachments } = record;
  const title = caseDisplayTitle(hearing, plan, attachments) + " (" + hearing.appId + ")";
  const summary = caseMetaDescription(hearing, caseDisplayTitle(hearing, plan, attachments), getCaseNextHearing(hearing, record.feed));
  const canonical = SITE_ORIGIN + "/us/id/nampa/plan/" + encodeURIComponent(hearing.appId);
  const images = [SITE_ORIGIN + (areaPath(record.locality.slug)+"/opengraph-image")];
  return { title, description: summary, alternates: { canonical },
    openGraph: { type: "website", title, description: summary, url: canonical, images },
    twitter: { card: "summary_large_image", title, description: summary, images },
  };
}

export default async function PlanPage({params}: {params: Promise<RouteParams>}) {
  const {planNumber} = await params;
  const record = await getCaseRecord(planNumber);
  if (!record) notFound();
  if (record.hearing.appId === "ANN-00369-2026") return NorthsideProjectPage({record});
  return CaseProjectPage({record});
}
