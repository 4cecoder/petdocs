"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@seridian/ui-kit";
import { api } from "@/lib/api";
import type { Pet } from "@/lib/api";

/**
 * Edit Pet modal (kit Dialog). Keeps the "Edit {name}'s Profile" dialog name,
 * the single required Pet Name input, and the "Save changes" action.
 */
export function EditPetDialog({
  pet,
  ownerId,
  open,
  onOpenChange,
  onSaved,
}: {
  pet: Pet;
  ownerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Partial<Pick<Pet, "name" | "breed" | "weightKg" | "microchipId">>) => void;
}) {
  const [name, setName] = useState(pet.name);
  const [breed, setBreed] = useState(pet.breed ?? "");
  const [weight, setWeight] = useState(pet.weightKg ? String(pet.weightKg) : "");
  const [microchip, setMicrochip] = useState(pet.microchipId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft whenever the dialog is (re)opened or the pet changes.
  useEffect(() => {
    if (!open) return;
    setName(pet.name);
    setBreed(pet.breed ?? "");
    setWeight(pet.weightKg ? String(pet.weightKg) : "");
    setMicrochip(pet.microchipId ?? "");
    setError(null);
  }, [open, pet]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give your pet a name. The name field can’t be empty.");
      return;
    }

    const weightNum = weight ? parseFloat(weight) : undefined;
    setSaving(true);
    setError(null);
    try {
      await api.pets.update({
        ownerId,
        petId: pet._id,
        name: trimmedName,
        breed: breed.trim() || undefined,
        weightKg: Number.isNaN(weightNum) ? undefined : weightNum,
        microchipId: microchip.trim() || undefined,
      });
      onSaved({
        name: trimmedName,
        breed: breed.trim() || undefined,
        weightKg: Number.isNaN(weightNum) ? undefined : weightNum,
        microchipId: microchip.trim() || undefined,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Couldn’t save changes: ${err.message}`
          : "Couldn’t save changes. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {pet.name}&apos;s Profile</DialogTitle>
          <DialogDescription>
            Update the basics — changes save to {pet.name}&apos;s profile
            immediately.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-pet-name">Pet name</Label>
            <Input
              id="edit-pet-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!name.trim()}
              aria-describedby={error ? "edit-pet-error" : undefined}
              placeholder="e.g. Biscuit"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-pet-breed">Breed</Label>
            <Input
              id="edit-pet-breed"
              type="text"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="e.g. Golden Retriever, French Bulldog"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-pet-weight">Weight (kg)</Label>
              <Input
                id="edit-pet-weight"
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-pet-microchip">Microchip ID</Label>
              <Input
                id="edit-pet-microchip"
                type="text"
                value={microchip}
                onChange={(e) => setMicrochip(e.target.value)}
                placeholder="15-digit number"
                inputMode="numeric"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
