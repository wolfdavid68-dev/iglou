/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as compte from "../compte.js";
import type * as consommations from "../consommations.js";
import type * as donnees from "../donnees.js";
import type * as inventaire from "../inventaire.js";
import type * as lib from "../lib.js";
import type * as maisons from "../maisons.js";
import type * as profils from "../profils.js";
import type * as signalements from "../signalements.js";
import type * as validateurs from "../validateurs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  compte: typeof compte;
  consommations: typeof consommations;
  donnees: typeof donnees;
  inventaire: typeof inventaire;
  lib: typeof lib;
  maisons: typeof maisons;
  profils: typeof profils;
  signalements: typeof signalements;
  validateurs: typeof validateurs;
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
