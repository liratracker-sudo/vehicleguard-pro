import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // 🚨 REGRA DE TIMEZONE - BLOQUEIA USO INCORRETO DE FORMATAÇÃO DE DATAS
      // Isso garante que todas as datas sejam formatadas corretamente no fuso horário de Brasília
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.property.name='toLocaleDateString']",
          "message": "❌ TIMEZONE: Use formatDateBR() de '@/lib/timezone' em vez de toLocaleDateString(). Veja TIMEZONE_GUIDE.md"
        },
        {
          "selector": "CallExpression[callee.property.name='toLocaleString'][callee.object.type='NewExpression'][callee.object.callee.name='Date']",
          "message": "❌ TIMEZONE: Use formatDateTimeBR() de '@/lib/timezone' em vez de toLocaleString() para datas. Veja TIMEZONE_GUIDE.md"
        },
        {
          "selector": "CallExpression[callee.property.name='toLocaleTimeString']",
          "message": "❌ TIMEZONE: Use formatTimeBR() de '@/lib/timezone' em vez de toLocaleTimeString(). Veja TIMEZONE_GUIDE.md"
        }
      ]
    },
  }
);
