const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qcvwzcosllwsvgubbmwh.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjdnd6Y29zbGx3c3ZndWJibXdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjY3MTI4NSwiZXhwIjoyMDkyMjQ3Mjg1fQ.K9ck0RJsZ5WFr0heCGKi9qHUFctmc-SQKQIlMNk2mGg";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Listing users from Supabase Auth...");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error listing users:", error.message);
    return;
  }

  console.log(`Found ${users.length} users in Supabase Auth.`);
  
  const targetEmails = [
    'arieffajarmarhas@gmail.com',
    'ariefffajarmarhas@gmail.com'
  ];

  for (const user of users) {
    console.log(`- User: ${user.email} (ID: ${user.id})`);
    if (targetEmails.includes(user.email)) {
      console.log(`  Deleting user ${user.email}...`);
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error(`  ❌ Failed to delete:`, delError.message);
      } else {
        console.log(`  ✅ Successfully deleted!`);
      }
    }
  }
}

run();
