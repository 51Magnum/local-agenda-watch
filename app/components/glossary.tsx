import{displayArea}from"@/lib/areas/format";
const definitions = {
  annexation: "Bringing land into the city's boundaries so city rules and services apply.",
  rezone: "Changing the zoning rules that determine permitted uses and development on land.",
  "preliminary plat": "A proposed subdivision layout showing lots, streets and shared areas before a final plat.",
  "P&Z": "The local planning review body.",
};

export function Glossary({ term, children, areaId }: { term: keyof typeof definitions; children?: React.ReactNode; areaId?: string }) {
  const area=displayArea(areaId);const definition=term==="P&Z"?area.bodies.planning.label+": reviews land-use requests and makes recommendations or decisions, depending on the case.":definitions[term];const label=term==="P&Z"?area.bodies.planning.shortLabel:term;
  return (
    <span className="group relative inline-block align-baseline">
      <button type="button" aria-label={label + ": " + definition} className="cursor-help border-b border-dotted border-current text-left focus-visible:outline-2 focus-visible:outline-offset-4">
        {children ?? label}
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 max-w-[75vw] rounded-lg bg-slate-800 p-3 text-left text-sm font-normal leading-6 text-white shadow-lg group-hover:block group-focus-within:block">
        {definition}
      </span>
    </span>
  );
}
