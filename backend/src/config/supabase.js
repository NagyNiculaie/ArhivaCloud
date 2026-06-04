const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Lipsește SUPABASE_URL în .env");
}

if (!supabaseKey) {
  throw new Error("Lipsește SUPABASE_SERVICE_ROLE_KEY în .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;