import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqgskbnqycyncrevyqub.supabase.co';

// Substitua pelo seu token que começa com eyJhbGciOi...
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZ3NrYm5xeWN5bmNyZXZ5cXViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU2OTE1MiwiZXhwIjoyMTA1MTQ1MTUyfQ.R_rvtMJjxo31saQcMFWXT0CKdgOdmMHhF77RsT5BBIc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);