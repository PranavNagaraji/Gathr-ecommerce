import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users, error } = await supabase
  .from('Users')
  .select('id, email, first_name, last_name, role');

if (error) {
  console.error('Supabase error:', error);
  process.exit(1);
}

for (const user of users) {
  const clerkUser = await clerk.users.createUser({
    emailAddress: [user.email],
    firstName: user.first_name,
    lastName: user.last_name,
    publicMetadata: { role: user.role },
    skipPasswordRequirement: true,
  });

  await supabase
    .from('Users')
    .update({ clerk_id: clerkUser.id })
    .eq('id', user.id);

  console.log(`Created ${user.email} → ${clerkUser.id} (${user.role})`);
}