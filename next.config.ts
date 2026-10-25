import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The same cached project metadata is included in <head> for browsers and share crawlers.
  htmlLimitedBots: /.*/,
  outputFileTracingIncludes: {"/*":["./public/nampa/**/*","./node_modules/pdfjs-dist/wasm/**/*","./node_modules/pdfjs-dist/standard_fonts/**/*","./node_modules/pdfjs-dist/cmaps/**/*","./node_modules/pdfjs-dist/legacy/build/pdf*.mjs"]},
  serverExternalPackages: ["pg", "unpdf", "@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
