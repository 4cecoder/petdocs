import { expect, test } from "@playwright/test";
import { addPetViaUi, archivePetViaHttp, signUpViaUi } from "./helpers";

/**
 * Pet CRUD through the real backend (dev Convex deployment).
 *
 * CREATE / READ / UPDATE are covered through the product UI below.
 *
 * DOCUMENTED PRODUCT GAP (delete): the backend is ready but the UI is not
 * wired: pets:archive exists (convex/pets.ts:104) and is wrapped in
 * src/lib/api.ts (api.pets.archive), but no dashboard component renders a
 * delete/archive control. Repro: sign in, open the pets list or any pet
 * profile: there is no affordance to remove a pet. The canary test below
 * encodes the gap so it cannot silently persist: when a delete control
 * ships, that test starts failing and should be replaced with real
 * end-to-end delete coverage. (Rename shipped while this suite was being
 * written; it now has a real end-to-end test through the Edit Pet modal.)
 */
test.describe("pets: real CRUD (create/read/update via UI)", () => {
  test("add a pet through the wizard, see it listed, open its profile", async ({
    page,
  }) => {
    const { ownerId } = await signUpViaUi(page, "petcrud");
    const name = `Zeta${Date.now().toString(36)}`;

    const petId = await addPetViaUi(page, {
      name,
      species: "cat",
      breed: "E2E Shorthair",
    });
    expect(petId).toMatch(/^[a-z0-9]+$/);

    // Listed: the PetCard carries name, species, and breed.
    const card = page.getByRole("link", { name: new RegExp(`^${name}`) });
    await expect(card).toBeVisible();
    await expect(card).toContainText("cat");
    await expect(card).toContainText("E2E Shorthair");

    // Profile: the card deep-links to the real pet record.
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/pets/${petId}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toHaveText(name);
    const main = page.locator("main");
    await expect(main.getByText("cat", { exact: true })).toBeVisible();
    await expect(main.getByText("E2E Shorthair")).toBeVisible();

    // Best-effort test-data cleanup (no delete UI exists; see gap above).
    await archivePetViaHttp(ownerId!, petId);
  });

  test("new owner starts with an empty vault", async ({ page }) => {
    await signUpViaUi(page, "petempty");

    const petsLink = page
      .getByRole("navigation", { name: "Dashboard" })
      .filter({ visible: true })
      .getByRole("link", { name: "Pets", exact: true });
    await petsLink.click();

    // Real backend round-trip: listByOwner returns [] for a fresh owner.
    await expect(
      page.getByText("No pets yet. Add your first pet to create its vault."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("rename a pet through the Edit Pet modal (persists server-side)", async ({
    page,
  }) => {
    const { ownerId } = await signUpViaUi(page, "petrename");
    const name = `Rex${Date.now().toString(36)}`;
    const petId = await addPetViaUi(page, { name, species: "dog" });

    await page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toHaveText(name);

    // Open the modal and rename.
    await page.getByRole("button", { name: "Edit Pet", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: new RegExp(`Edit ${name}'s Profile`),
    });
    await expect(dialog).toBeVisible();
    // Pet Name is the modal's only required input.
    const renamed = `${name} II`;
    await dialog.locator("input[required]").fill(renamed);
    await dialog.getByRole("button", { name: "Save changes" }).click();

    // The modal closes and the header reflects the rename immediately.
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();

    // Prove persistence: a fresh navigation still shows the new name.
    await page.goto("/dashboard/pets");
    await expect(
      page.getByRole("link", { name: new RegExp(`^${renamed}`) }),
    ).toBeVisible({ timeout: 15_000 });

    await archivePetViaHttp(ownerId!, petId);
  });

  test("canary: pet delete/archive still has no UI (see header comment)", async ({
    page,
  }) => {
    const { ownerId } = await signUpViaUi(page, "petgap");
    const name = `Roo${Date.now().toString(36)}`;
    const petId = await addPetViaUi(page, { name, species: "dog" });

    await page.getByRole("link", { name: new RegExp(`^${name}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toHaveText(name);

    // Backend supports archive (convex/pets.ts:104), but no dashboard
    // surface renders the control. When one ships, this fails: replace it
    // with a real delete flow instead of deleting the test.
    await expect(
      page.getByRole("button", { name: /(delete|archive|remove).*pet|pet.*(delete|archive|remove)/i }),
    ).toHaveCount(0);

    await page.goto("/dashboard/pets");
    await expect(
      page.getByRole("button", { name: /(delete|archive|remove).*pet|pet.*(delete|archive|remove)/i }),
    ).toHaveCount(0);

    await archivePetViaHttp(ownerId!, petId);
  });
});
