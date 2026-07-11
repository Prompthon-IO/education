/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCADE_AVATAR_SHEET_URL?: string;
  readonly VITE_ARCADE_AVATAR_PREVIEW_URL?: string;
  readonly VITE_ARCADE_AVATAR_MANIFEST_URL?: string;
  readonly VITE_ARCADE_LEADERBOARD_STORAGE_KEY?: string;
  readonly VITE_ARCADE_DEFAULT_PLAYER_NAME?: string;
  readonly VITE_ARCADE_ENABLE_VOICE?: string;
  readonly VITE_ARCADE_ENABLE_FACE?: string;
  readonly VITE_ARCADE_FACE_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
