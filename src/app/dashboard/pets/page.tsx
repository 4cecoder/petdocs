/** TODO(convex): pets.listByOwner → grid of PetCard + "+ Add pet". */
export default function PetsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Pets</h1>
        <button
          type="button"
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Add pet
        </button>
      </div>
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
        No pets yet. Add your first pet to create its vault.
      </div>
    </div>
  );
}
