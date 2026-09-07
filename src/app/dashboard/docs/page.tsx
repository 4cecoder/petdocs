import { DocList } from "@/components/docs/DocList";

/** Global filterable doc list. TODO(convex): per-pet queries + category filter. */
export default function DocsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Documents</h1>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by pet">
        <span className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
          All pets
        </span>
      </div>
      <DocList docs={[]} />
    </div>
  );
}
