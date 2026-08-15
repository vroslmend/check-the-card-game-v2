import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // `next lint` applied these implicitly. The ESLint CLI does not, and it is
    // the only entry point left once Next 16 removes `next lint`, so the scope
    // has to be stated here. Without it a run walks the build output and
    // reports about 15,000 problems, none of them ours.
    ignores: ["**/node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
