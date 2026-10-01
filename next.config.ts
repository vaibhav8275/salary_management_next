import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle in .next/standalone, including only the
  // node_modules actually reached during the build.
  //
  // Without this the production image needs the full node_modules tree copied in,
  // which is roughly 400MB of dev-only dependencies -- types, eslint, test
  // fixtures -- for an app that needs none of them at runtime. The Rails
  // Dockerfile does the same thing with `bundle install --without`.
  output: "standalone",

  // Server Actions cap their request body at 1MB unless told otherwise, and the
  // limit applies to the whole multipart body rather than the file inside it.
  // Left alone, any upload over 1MB is rejected by Next before Rails sees it,
  // and the rejection surfaces as a minified React error in the browser instead
  // of the validation message the model would have produced — the promise of a
  // 2MB file is simply not reachable.
  //
  // Set above `SalaryImport::MAX_FILE_SIZE` rather than equal to it, because the
  // body carries multipart boundaries and headers around the file. This is only
  // transport headroom; the 2MB rule belongs to Rails and is enforced there.
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },

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
