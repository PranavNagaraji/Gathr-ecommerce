import supabase from "./db.js";

async function run() {
  try {
    const clerkId = "user_3EiVb09ufxFSBgNJYjlY9JqznCY";
    const carrierData = {
      phone: "+919999999999",
      licenseNumber: "DL12345",
      aadharNumber: "123456789012",
      bankAccount: "1234567890",
      verified: true
    };
    const { data, error } = await supabase
      .from('Users')
      .update({ 'delivery_details': carrierData })
      .eq('clerk_id', clerkId)
      .select();
    
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (e) {
    console.error("Exception:", e);
  }
}

run();
