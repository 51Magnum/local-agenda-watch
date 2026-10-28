/** Explicit organization indicators only; unfamiliar names stay under manual review. */
export function organizationApplicant(value:unknown){
 const text=String(value??"");
 return /\b(?:LLC|L\.?L\.?C\.?|INC|CORP|COMPANY|CO\.|TRUST|LP|LLP|LTD|PARTNERS|PARTNERSHIP|HOLDINGS|ASSOCIATES|DEVELOPMENT|DEVELOPERS|HOMES|BUILDERS|COUNTY|DEPARTMENT|AUTHORITY|COMMISSION|AGENCY|FOUNDATION|UNIVERSITY|HOA|ASSOCIATION)\b/i.test(text)||/\b(?:City of|State of|Church of|School District|School Board)\b/i.test(text);
}
export function applicantNeedsReview(value:unknown){return !organizationApplicant(value);}
