import { expect, it } from "vitest";
import { alertEmailDocument, confirmationEmail } from "./alert-email";

it("explains both confirmation steps and uses the same destination in HTML and plain text", () => {
  const url = "https://example.test/api/alerts/confirm?token=example";
  const email = confirmationEmail({ kind: "place", label: "Ridgeside Subdivision", radiusMiles: 1 }, url);
  expect(email.html).toContain(`href="${url}"`);
  expect(email.html).toContain("Confirm my alerts</a>");
  expect(email.html).toContain("select “Confirm alerts” on the page");
  expect(email.text).toContain(url);
  expect(email.text).toContain("within 1 mile of Ridgeside Subdivision");
  expect(email.text).toContain("No changes means no email.");
  expect(email.text).toContain("48 hours");
});

it("escapes submitted labels and footer values instead of inserting email markup", () => {
  const email = confirmationEmail({ kind: "place", label: '<img src=x> & "Home"', radiusMiles: 2 }, "https://example.test/?a=1&b=2");
  const html = alertEmailDocument(email.html, "<Office> & Co", "https://example.test/?a=1&b=2");
  expect(html).not.toContain("<img src=x>");
  expect(html).toContain("&lt;img src=x&gt; &amp; &quot;Home&quot;");
  expect(html).toContain("&lt;Office&gt; &amp; Co");
  expect(html).toContain('href="https://example.test/?a=1&amp;b=2"');
});

it("tells waitlist recipients to choose a watch after confirming", () => {
  const email = confirmationEmail({ kind: "pending", label: "Nampa" }, "https://example.test/confirm");
  expect(email.text).toContain("choose a project or address on the map to start alerts");
  expect(email.text).not.toContain("you’ll receive at most one daily email");
});
