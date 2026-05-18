/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_ANON_KEY: string | undefined;
  /** Headless WordPress REST base (e.g. https://cms.example.com/wp-json/huxzain/v1). */
  readonly VITE_WORDPRESS_API_BASE: string | undefined;
  readonly VITE_CLOUDINARY_CLOUD_NAME: string | undefined;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET: string | undefined;
  readonly VITE_RAZORPAY_KEY_ID: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
