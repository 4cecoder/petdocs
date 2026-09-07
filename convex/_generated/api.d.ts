/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as magicLink from "../magicLink.js";
import type * as medications from "../medications.js";
import type * as pets from "../pets.js";
import type * as reminders from "../reminders.js";
import type * as resend from "../resend.js";
import type * as seed from "../seed.js";
import type * as shareLinks from "../shareLinks.js";
import type * as vaccinations from "../vaccinations.js";
import type * as vetVisits from "../vetVisits.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  documents: typeof documents;
  http: typeof http;
  magicLink: typeof magicLink;
  medications: typeof medications;
  pets: typeof pets;
  reminders: typeof reminders;
  resend: typeof resend;
  seed: typeof seed;
  shareLinks: typeof shareLinks;
  vaccinations: typeof vaccinations;
  vetVisits: typeof vetVisits;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
