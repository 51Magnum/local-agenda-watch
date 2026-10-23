/** Only an explicitly started Review activity establishes an under-review date.
 * Scheduled/completed/last-action dates are never substituted. */
export function workflowReviewStart(activities: Record<string, unknown>[]) {
  for (const activity of activities) {
    const name = activity.Name ?? activity.ActivityName ?? activity.Description;
    if (typeof name !== "string" || !/^(?:under\s+)?review$/i.test(name.trim())) continue;
    for (const key of ["ActualStartDate", "StartedDate", "DateStarted"]) {
      const value = activity[key];
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return { value: value.slice(0, 10), quote: "Workflow " + name + " — " + key + ": " + value };
    }
  }
}
