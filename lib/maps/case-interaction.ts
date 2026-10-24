/** Touch/pen taps preview first, including on laptops with a mouse attached. */
export function opensCasePage(compact: boolean, pointerType: string, touchGenerated = false): boolean {
  return !compact && pointerType === "mouse" && !touchGenerated;
}
