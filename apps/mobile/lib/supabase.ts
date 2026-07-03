import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Public by design (they ship in every client bundle) — real secrets live
// only in Edge Function secrets. Env vars override for local development.
const DEFAULT_URL = "https://mxmehizzrlrbegrujdjp.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_RHfpdBqoqh-9YbrwbjkcWw_IjFbrAI0";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? DEFAULT_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_PUBLISHABLE_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
