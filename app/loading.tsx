export default function Loading() {
  return <div className="mx-auto max-w-6xl animate-pulse px-8 py-12"><div className="h-60 rounded-3xl bg-zinc-200" /><div className="mt-10 h-7 w-40 rounded bg-zinc-200" /><div className="mt-5 grid gap-4 sm:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-40 rounded-2xl bg-zinc-200" />)}</div></div>;
}
