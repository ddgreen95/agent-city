/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_PRODUCT?: "both" | "city" | "graph" }
interface ImportMeta { readonly env: ImportMetaEnv }
