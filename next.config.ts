import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pdf-parse",
    "pdfjs-dist",
  ],
};

export default withWorkflow(nextConfig);