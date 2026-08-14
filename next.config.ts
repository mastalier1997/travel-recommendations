import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pdf-parse ships a debug-mode file read that webpack tries (and fails) to
  // statically analyze if bundled. Keeping it a real require in the Node runtime
  // sidesteps that entirely.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
