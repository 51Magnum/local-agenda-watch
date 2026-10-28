/** Explicit organization indicators only; unfamiliar names stay under manual review. */
export function organizationApplicant(value:unknown){
 return /\b(?:LLC|L\.?L\.?C\.?|INC|CORP|COMPANY|CO\.|TRUST|LP|LLP|LTD|PARTNERS|PARTNERSHIP|HOLDINGS|ASSOCIATES|DEVELOPMENT|DEVELOPERS|HOMES|BUILDERS|CHURCH|SCHOOL|DISTRICT|COUNTY|CITY|STATE|DEPARTMENT|AUTHORITY|COMMISSION|AGENCY|FOUNDATION|UNIVERSITY|HOA|ASSOCIATION)\b/i.test(String(value??""));
}
export function applicantNeedsReview(value:unknown){return !organizationApplicant(value);}
