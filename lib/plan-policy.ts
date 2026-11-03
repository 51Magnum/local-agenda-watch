/** The only application setting for the paid pin allowance; synced into the DB policy. */
export const PAID_PIN_LIMIT = 5;
export type ResidentPlan = "free" | "paid";
export const pinLimit = (plan: ResidentPlan) => plan === "paid" ? PAID_PIN_LIMIT : 1;
export function validatePlanRadius(plan: ResidentPlan, radius: number) {
  if (!Number.isFinite(radius) || radius < 0.25 || radius > 10 || plan === "free" && radius !== 1)
    throw Error(plan === "free" ? "Free pins use a 1 mile radius." : "Choose a radius from 0.25 to 10 miles.");
}
