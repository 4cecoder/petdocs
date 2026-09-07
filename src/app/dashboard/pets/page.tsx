"use client";

import { useEffect, useState } from "react";
import { PetCard } from "@/components/pets/PetCard";
import { api, getOwnerId, isBackendConfigured, type Pet } from "@/lib/api";
import { PET_SPECIES, validatePetName, type PetSpecies } from "@/lib/validators";

export default function PetsPage() {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pets, setPets] = useState<Pet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<PetSpecies>("dog");
  const [breed, setBreed] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId || !backend) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.pets
      .list(ownerId)
      .then((rows) => {
        if (!cancelled) setPets(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load pets.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, backend]);

  if (!ownerId || !backend) {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId) return;
    const nameProblem = validatePetName(name);
    if (nameProblem) {
      setFormError(nameProblem);
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await api.pets.create({
        ownerId,
        name: name.trim(),
        species: species,
        ...(breed.trim() ? { breed: breed.trim() } : {}),
      });
      const rows = await api.pets.list(ownerId);
      setPets(rows);
      setName("");
      setBreed("");
      setSpecies("dog");
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not add pet.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Pets</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ Add pet"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
                placeholder="Biscuit"
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Species
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as PetSpecies)}
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3 capitalize"
              >
                {PET_SPECIES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Breed <span className="font-normal text-ink-soft">(optional)</span>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Golden retriever"
                className="min-h-[48px] rounded-xl border border-ink/15 bg-cream px-3"
              />
            </label>
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating}
            className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add pet"}
          </button>
        </form>
      ) : null}

      <div aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-ink-soft">
            Loading pets…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      {!loading && !error && (pets === null || pets.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
          No pets yet. Add your first pet to create its vault.
        </div>
      ) : null}

      {pets && pets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <PetCard
              key={pet._id}
              pet={{
                id: pet._id,
                name: pet.name,
                species: pet.species,
                ...(pet.breed ? { breed: pet.breed } : {}),
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
