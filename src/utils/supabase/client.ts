import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const isTest = process.env.NODE_ENV === "test";

if (isTest) {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config(); // load default .env
}

const supabaseUrl = isTest
  ? process.env.SUPABASE_TEST_URL!
  : process.env.SUPABASE_URL!;

const supabaseKey = isTest
  ? process.env.SUPABASE_TEST_KEY!
  : process.env.SUPABASE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
