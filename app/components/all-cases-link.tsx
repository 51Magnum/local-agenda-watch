"use client";

export default function AllCasesLink({ className }: { className?: string }) {
  return <a href="#all-cases" className={className} onClick={() => {
    const list = document.getElementById("all-cases");
    if (list instanceof HTMLDetailsElement) list.open = true;
  }}>All cases</a>;
}
