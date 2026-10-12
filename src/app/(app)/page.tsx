// `/` and `/dashboard` serve the same page. Rerouting the export rather than
// copying the fetch + redirect logic keeps a single source of truth for it.
export { default, metadata } from "./dashboard/page";