import { createElement } from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import ProjectPane from "@/app/components/maps/project-pane";
import {
  RESIDENT_QUESTIONS,
  type PaneData,
} from "@/lib/maps/project-questions";

it("always renders the six questions without accordions, including honest missing-data answers and non-looping case numbers", () => {
  const data = {
    area: { id: "nampa", name: "City of Nampa", timezone: "America/Denver" },
    item: {
      id: "EXAMPLE",
      title: "Example proposal",
      href: "/us/id/nampa/plan/EXAMPLE",
      stage: "In review",
    },
    caseIds: ["EXAMPLE"],
    relatedCases: [
      {
        areaId: "nampa",
        caseId: "EXAMPLE",
        label: "Nampa",
        href: "/us/id/nampa/plan/EXAMPLE",
      },
    ],
    history: [],
    impacts: [],
    conditions: [],
    updatedAt: "2026-10-25",
    officialRecords: [
      {
        label: "Official hearing record",
        url: "https://nampa.primegov.com/Portal/Meeting?meetingTemplateId=10062",
      },
    ],
  } as unknown as PaneData;
  const $ = load(
    renderToStaticMarkup(
      createElement(ProjectPane, {
        data,
        onClose: () => {},
        onImage: () => {},
        onWatch: () => {},
      }),
    ),
  );
  expect(
    $("h2.law-question-heading")
      .map((_, el) => $(el).text())
      .get(),
  ).toEqual([...RESIDENT_QUESTIONS]);
  expect($("details")).toHaveLength(0);
  expect($.text()).toContain("Location is not confirmed");
  expect($.text()).toContain("No verified impact details");
  expect(
    $("a")
      .toArray()
      .some((a) => /^\/\?project=/.test($(a).attr("href") ?? "")),
  ).toBe(false);
  expect($(".law-case-references").text()).toContain("EXAMPLE");
  expect($("a[href^='https://nampa.primegov.com/']")).toHaveLength(1);
});
