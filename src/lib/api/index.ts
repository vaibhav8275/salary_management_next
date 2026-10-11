// The public API surface. Callers keep importing from "@/lib/api" — domain
// modules hang off the shared client, which owns the fetch/envelope/error
// plumbing so no module re-implements it.
export * from "./client";
export * from "./auth";
export * from "./employees";
export * from "./imports";
export * from "./reports";