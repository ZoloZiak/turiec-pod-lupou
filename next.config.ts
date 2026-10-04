import type { NextConfig } from "next";

// Typecheck beží ako súčasť buildu. Predtým tu bolo `ignoreBuildErrors: true`,
// ktoré ticho prepúšťalo ~60 type errorov do produkcie — odstránené po tom,
// čo `tsc --noEmit` prešiel načisto. Nechaj to tak: build nech padne na type erroroch.
const nextConfig: NextConfig = {};

export default nextConfig;
