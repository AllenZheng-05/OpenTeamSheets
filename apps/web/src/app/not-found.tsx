import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-neutral-500">
        The team may have been removed, or the link may be mistyped.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
      >
        Browse teams
      </Link>
    </div>
  );
}
