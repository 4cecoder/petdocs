"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@seridian/ui-kit";
import { PetCard } from "@/components/pets/PetCard";
import { FlowNav, WizardShell, useSteps } from "@/components/flow/Wizard";
import { api, getOwnerId, isBackendConfigured, type Pet } from "@/lib/api";
import { PET_SPECIES, validatePetName, type PetSpecies } from "@/lib/validators";

const STEPS = ["Name", "Details"];

export default function PetsPage() {
  const ownerId = getOwnerId();
  const backend = isBackendConfigured;

  const [pets, setPets] = useState<Pet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const { step, next, back, go } = useSteps(STEPS.length, 0);
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

  function handleToggle() {
    setShowForm((v) => {
      if (!v) {
        go(0);
        setFormError(null);
      } else {
        go(0);
        setFormError(null);
      }
      return !v;
    });
  }

  function handleClose() {
    setShowForm(false);
    go(0);
    setFormError(null);
  }

  function handleGo(n: number) {
    if (n === 1 && validatePetName(name)) return;
    go(n);
  }

  async function handleCreate() {
    if (!ownerId) return;
    const nameProblem = validatePetName(name);
    if (nameProblem) {
      setFormError(nameProblem);
      go(0);
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
      go(0);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not add pet.");
    } finally {
      setCreating(false);
    }
  }

  const nameProblem = validatePetName(name);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Pets</h1>
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={showForm}
          className="min-h-[48px] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "+ Add pet"}
        </button>
      </div>

      {showForm ? (
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          {step === 0 ? (
            <WizardShell
              steps={STEPS}
              current={step}
              onGo={handleGo}
              art="happy"
              title="Name your pet"
              subtitle="What do we call them?"
              nav={
                <div className="mt-4">
                  <FlowNav
                    onBack={handleClose}
                    backLabel="Cancel"
                    onNext={next}
                    nextLabel="Continue"
                    nextDisabled={!!nameProblem}
                  />
                </div>
              }
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pet-name">Name</Label>
                <Input
                  id="pet-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  placeholder="Biscuit"
                  aria-invalid={!!nameProblem && name.trim() !== ""}
                  className="min-h-[48px]"
                />
              </div>
              {nameProblem && name.trim() ? (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {nameProblem}
                </p>
              ) : null}
              {formError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {formError}
                </p>
              ) : null}
            </WizardShell>
          ) : null}

          {step === 1 ? (
            <WizardShell
              steps={STEPS}
              current={step}
              onGo={handleGo}
              art="box"
              title="Pet details"
              subtitle={`A little more about ${name.trim() || "your pet"}.`}
              nav={
                <div className="mt-4">
                  <FlowNav
                    onBack={back}
                    backLabel="Back"
                    onNext={() => void handleCreate()}
                    nextLabel={creating ? "Adding…" : "Add pet"}
                    loading={creating}
                  />
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pet-species">Species</Label>
                  <Select
                    value={species}
                    onValueChange={(value) => setSpecies(value as PetSpecies)}
                  >
                    <SelectTrigger
                      id="pet-species"
                      className="min-h-[48px] w-full capitalize"
                      aria-label="Species"
                    >
                      <SelectValue placeholder="Species" />
                    </SelectTrigger>
                    <SelectContent>
                      {PET_SPECIES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pet-breed">
                    Breed <span className="font-normal text-ink-soft">(optional)</span>
                  </Label>
                  <Input
                    id="pet-breed"
                    type="text"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="Golden retriever"
                    className="min-h-[48px]"
                  />
                </div>
              </div>
              {formError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {formError}
                </p>
              ) : null}
            </WizardShell>
          ) : null}
        </div>
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink-soft">
          <p>No pets yet. Add your first pet to create its vault.</p>
          <button
            type="button"
            onClick={handleToggle}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 transition"
          >
            <Plus size={16} aria-hidden="true" />
            Add your first pet
          </button>
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
