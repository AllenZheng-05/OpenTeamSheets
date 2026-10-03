export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500">
      {children}
    </p>
  );
}
