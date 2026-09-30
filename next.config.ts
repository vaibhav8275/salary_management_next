import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only. The dev server serves its HMR client and other dev resources
  // under a same-origin check, and a machine reached as `127.0.0.1` is a
  // different origin from the `localhost` it bound to. Without this, the page
  // is served but never hydrates: no React, no Server Action interception, and
  // a form submit falls back to a native POST that resets every field. It
  // surfaces only as a form that forgets what you typed and a silent console
  // error, so it is worth naming explicitly.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
