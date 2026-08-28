import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  console.log("BUILD MODE:", mode);
  console.log("API URL:", env.VITE_API_BASE_URL);

  return {
    plugins: [react()],
  };
});