import express from "express";

const app = express();
app.use(express.json());
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./utils/supabase/client";

async function testDb() {
  const { data, error } = await supabase.from("contacts").select("*").limit(1);
  if (error) {
    console.error("Supabase query error:", error);
  } else {
    console.log("Supabase query success:", data);
  }
}

// testDb();

app.get("/", (_, res) => {
  testDb();
  res.send("Bitespeed server is running");
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
