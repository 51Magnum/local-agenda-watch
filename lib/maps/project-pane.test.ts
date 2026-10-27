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

function impactPane(page = false) {
  const data = {
    area: { id: "nampa", name: "City of Nampa", timezone: "America/Denver" },
    item: { id: "EXAMPLE", title: "Example proposal", href: "/us/id/nampa/plan/EXAMPLE", stage: "In review" },
    caseIds: ["EXAMPLE"], history: [], updatedAt: "2026-10-25",
    impacts: [
      { label: "Road access", value: "The applicant proposes an entrance on Maple Road; approval is not confirmed.", url: "https://city.example/report.pdf#page=12", sourceTitle: "Staff report", sourcePage: 12 },
      { label: "Schools", value: "The district reports limited capacity; no assignment is confirmed.", url: "https://city.example/report.pdf#page=15" },
      { label: "Construction", value: "The applicant estimates two phases; no start date is confirmed.", url: "https://city.example/report.pdf#page=18" },
    ],
    conditions: ["Provide a sidewalk.", "Provide a crossing.", "Submit final drainage plans."],
    conditionsSource: "https://city.example/decision.pdf#page=3",
  } as unknown as PaneData;
  return load(renderToStaticMarkup(createElement(ProjectPane, { data, page, onClose: () => {}, onImage: () => {}, onWatch: () => {} })));
}

it("keeps two impact answers visible and the remaining sourced answer expandable in place", () => {
  const $ = impactPane();
  const section = $("h2.law-question-heading").eq(4).parent();
  expect(section.children("div").find("h3").map((_, el) => $(el).text()).get()).toEqual(["Road access", "Schools"]);
  const more = section.children("details").first();
  expect(more.attr("open")).toBeUndefined();
  expect(more.find("summary").text()).toBe("More documented details (1)");
  expect(more.text()).toContain("The applicant estimates two phases; no start date is confirmed.");
  expect(more.find("a").attr("href")).toBe("https://city.example/report.pdf#page=18");
  expect(section.text()).toContain("The applicant proposes an entrance on Maple Road; approval is not confirmed.");
  expect(section.text()).toContain("The district reports limited capacity; no assignment is confirmed.");
  const source = section.find("a[href$='#page=12']");
  expect(source.text()).toBe("Source · p. 12");
  expect(source.attr("title")).toBe("Staff report");
  expect(source.attr("aria-label")).toBe("Official source for Road access, page 12");
  expect(section.children("ul").children("li")).toHaveLength(2);
  expect(section.children("details").last().text()).toContain("Submit final drainage plans.");
});

it("shows all documented impact answers on the full project page", () => {
  const $ = impactPane(true);
  const section = $("h2.law-question-heading").eq(4).parent();
  expect(section.children("div").find("h3")).toHaveLength(3);
  expect(section.children("details")).toHaveLength(0);
  expect(section.children("ul").children("li")).toHaveLength(3);
});
