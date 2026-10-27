/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acces from "../acces.js";
import type * as auth from "../auth.js";
import type * as compte from "../compte.js";
import type * as donnees from "../donnees.js";
import type * as http from "../http.js";
import type * as lots from "../lots.js";
import type * as maisons from "../maisons.js";
import type * as motsDePasse from "../motsDePasse.js";
import type * as signalements from "../signalements.js";
import type * as transfert from "../transfert.js";
import type * as utilisateurs from "../utilisateurs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  acces: typeof acces;
  auth: typeof auth;
  compte: typeof compte;
  donnees: typeof donnees;
  http: typeof http;
  lots: typeof lots;
  maisons: typeof maisons;
  motsDePasse: typeof motsDePasse;
  signalements: typeof signalements;
  transfert: typeof transfert;
  utilisateurs: typeof utilisateurs;
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
