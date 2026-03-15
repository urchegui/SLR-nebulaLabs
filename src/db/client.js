import 'dotenv/config'
import { createClient } from "@supabase/supabase-js";

if(!process.env.SUPABASE_URL || !process.env.DB_KEY){
    throw new Error('No db url or db key in .env');
}

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.DB_KEY
)