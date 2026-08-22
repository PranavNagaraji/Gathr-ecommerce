import dotenv from "dotenv";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: "../.env",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const products = JSON.parse(
  fs.readFileSync("./generated-data.json", "utf-8")
);

const { error } = await supabase
  .from("Items")
  .insert(products);

if (error) {
  console.error("Insert failed:");
  console.error(error);
} else {
  console.log(
    `Inserted ${products.length} products`
  );
}