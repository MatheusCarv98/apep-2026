import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Configure o arquivo .env (veja .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
