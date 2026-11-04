import {expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import MapNotice from "./map-notice";
it("announces routine notices politely and keeps an accessible early-close action", () => {
  const html = renderToStaticMarkup(<MapNotice message="Pin and circle cleared." onDismiss={() => {}}/>);
  expect(html).toContain('role="status"'); expect(html).toContain('aria-atomic="true"');
  expect(html).toContain('aria-label="Dismiss message"'); expect(html).toContain("Pin and circle cleared.");
});
it("announces persistent errors assertively with a dismiss button", () => {
  const html = renderToStaticMarkup(<MapNotice message="Map could not load." kind="error" onDismiss={() => {}}/>);
  expect(html).toContain('role="alert"'); expect(html).toContain('data-kind="error"');
  expect(html).toContain('aria-label="Dismiss message"');
});
