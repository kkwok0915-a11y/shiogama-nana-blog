/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHOTOS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
