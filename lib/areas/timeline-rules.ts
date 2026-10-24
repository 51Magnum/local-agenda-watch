/** Official file labels, interpreted within each jurisdiction's configured sources. */
export const TIMELINE_DOCUMENT_RULES = [
 {kind:"staff-report",pattern:"staff[\\s_-]*report|agency.*comment|ACHD.*(?:FINAL|REPORT)"},
 {kind:"minutes",pattern:"minutes"},
 {kind:"pz-decision",pattern:"(?:decision|determination|action|findings).*(?:PZ|P&Z|planning.*zoning)"},
 {kind:"council-decision",pattern:"(?:decision|determination|action|findings).*(?:council|board|BOCC)"},
 {kind:"findings",pattern:"reasoned|findings|FCO|decision|determination|action[\\s_-]*letter"},
] as const;
