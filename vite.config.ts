import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const rawPort = process.env.PORT ?? process.env.VITE_PORT;
  const port = rawPort ? Number(rawPort) : 5173;

  if (rawPort && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? process.env.BASE_URL ?? "/";

  const plugins: any[] = [];

  try {
    const reactPlugin = (await import("@vitejs/plugin-react")).default;
    if (typeof reactPlugin === "function") plugins.push(reactPlugin());
  } catch (e) {}

  try {
    const tailwindModule = await import("@tailwindcss/vite").catch(() => null);
    const tailwind = tailwindModule?.default ?? null;
    if (typeof tailwind === "function") plugins.push(tailwind());
  } catch (e) {}

  try {
    const runtimeErrorOverlay = (
      await import("@replit/vite-plugin-runtime-error-modal")
    ).default;
    if (typeof runtimeErrorOverlay === "function")
      plugins.push(runtimeErrorOverlay());
  } catch (e) {}

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
  ) {
    try {
      const cartographerModule =
        await import("@replit/vite-plugin-cartographer");
      const cartographer =
        cartographerModule.cartographer ?? cartographerModule.default;
      if (typeof cartographer === "function") {
        plugins.push(
          cartographer({
            root: path.resolve(__dirname, ".."),
          }),
        );
      }
    } catch (e) {}

    try {
      const devBannerModule = await import("@replit/vite-plugin-dev-banner");
      const devBanner = devBannerModule.devBanner ?? devBannerModule.default;
      if (typeof devBanner === "function") plugins.push(devBanner());
    } catch (e) {}
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@assets": path.resolve(__dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(__dirname),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
