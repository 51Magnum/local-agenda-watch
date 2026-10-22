import type { Metadata } from "next";
import { SITE_ORIGIN } from "@/lib/site-config";
import Link from "next/link";
import { listLocalities, getTrackedCaseCount } from "@/lib/localities";

export const metadata: Metadata = {
  title: { absolute: "Nampa Rezoning, Annexation & Public Hearing Tracker | Local Agenda Watch" },
  alternates: { canonical: SITE_ORIGIN + "/" },
};

export default async function Home() {
  const localities = await Promise.all(listLocalities().map(async (locality) => {
    try {
      const feed = await locality.getHearings?.();
      return { locality, count: getTrackedCaseCount(locality, feed) };
    } catch (err) {
      console.error("[home] Could not load tracked cases for " + locality.slug, err);
      return { locality, count: null };
    }
  }));
  return (
    <div className="flex flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-16 sm:py-24">
        <section className="flex flex-col gap-6">
          <p className="font-mono text-sm uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Local Agenda Watch
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Know what your local government is planning &mdash; before it happens.
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Local Agenda Watch surfaces upcoming land development, rezoning,
            and other municipal decisions so residents can show up informed at
            public meetings.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Localities
          </h2>
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {localities.map(({ locality, count }) => (
              <li key={locality.slug}>
                <Link
                  href={`/${locality.slug}`}
                  className="flex items-center justify-between py-5 hover:text-black dark:hover:text-zinc-50"
                >
                  <span className="font-medium text-black dark:text-zinc-50">
                    {locality.fullName}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {count === null ? "View tracked cases" : `${count} ${count === 1 ? "item" : "items"} tracked`} &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            More localities coming as we grow.
          </p>
        </section>
      </main>
    </div>
  );
}
