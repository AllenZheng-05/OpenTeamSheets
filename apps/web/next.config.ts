import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ots/core ships TypeScript source, so Next compiles it.
  transpilePackages: ["@ots/core"],
  images: {
    // Pokémon sprites (HOME renders) from Pokémon Showdown.
    remotePatterns: [new URL("https://play.pokemonshowdown.com/sprites/**")],
  },
};

export default nextConfig;
