"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center px-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">We couldn’t load your documents</h1><p className="mt-3 text-sm leading-6 text-zinc-600">Check the database connection and make sure the demo users have been seeded.</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main>;
}
