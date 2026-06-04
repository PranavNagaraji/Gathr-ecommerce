import { createClient } from '@supabase/supabase-js';
import { Clerk } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const clerk = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

async function run() {
  console.log("Fetching owner details from DB...");
  const { data: users, error } = await supabase.from('Users').select('id, clerk_id').in('id', [8, 10]);
  if (error) {
    console.error("Users error:", error);
    return;
  }
  console.log("Users:", users);

  for (const u of users) {
    if (!u.clerk_id) {
      console.log(`User ${u.id} has no clerk_id!`);
      continue;
    }
    console.log(`Fetching Clerk user info for clerk_id: ${u.clerk_id}...`);
    try {
      const cu = await clerk.users.getUser(u.clerk_id);
      console.log(`Clerk user ${u.clerk_id} fetched successfully. banned?`, cu?.publicMetadata?.shop_banned);
    } catch (e) {
      console.error(`Error fetching clerk user ${u.clerk_id}:`, e.message);
    }
  }
}

run();
