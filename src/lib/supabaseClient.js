// src/lib/supabaseClient.js
// ─────────────────────────────────────────────────────────────
// Single source of truth for the Supabase client.
// Import `supabase` from here everywhere in the app —
// never create a second instance, or you'll get duplicate
// real-time subscriptions and auth race conditions.
//
// Required .env variables (create a .env.local file):
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGc...
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Sprout] Missing Supabase env vars. ' +
    'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist session in localStorage so the user stays logged in
    // across page refreshes without re-authenticating.
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Heartbeat keeps WebSocket alive on mobile/flaky connections.
    heartbeatIntervalMs: 20_000,
  },
});

// ─────────────────────────────────────────────────────────────
// Typed query helpers
// These thin wrappers centralise table names & column selection
// so a schema rename only needs fixing in one place.
// ─────────────────────────────────────────────────────────────

/** Fetch all transactions for the currently-authenticated user. */
export async function fetchTransactions(userId) {
  if (!userId) return []; // Safety check
  
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, type, amount, category, note, date, goal_id, created_at,
      goals ( id, name )
    `)
    .eq('user_id', userId) // ⭐ Limits results to the logged-in user
    .order('date',       { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Fetch all goals (with computed progress) for the current user. */
export async function fetchGoals(userId) {
  if (!userId) return []; // Safety check
  
  const { data, error } = await supabase
    .from('goal_progress')  // use the DB view — progress is pre-computed
    .select('*')
    .eq('user_id', userId) // ⭐ Limits results to the logged-in user
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/** Fetch or create user settings row. Returns the settings object. */
export async function fetchOrCreateSettings(userId) {
  // Try to read first
  const { data: existing, error: readError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing;

  // Row doesn't exist yet — create it with defaults
  if (readError?.code === 'PGRST116') {
    const { data: created, error: insertError } = await supabase
      .from('user_settings')
      .insert({ user_id: userId })
      .select()
      .single();

    if (insertError) throw insertError;
    return created;
  }

  throw readError;
}

/** Insert a single transaction. Returns the newly created row. */
export async function insertTransaction(payload) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a transaction by ID. */
export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/** Insert a new savings goal. Returns the newly created row. */
export async function insertGoal(payload) {
  const { data, error } = await supabase
    .from('goals')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a goal and let the DB cascade-null related transactions. */
export async function deleteGoal(id) {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/** Upsert user settings (creates if missing, updates if present). */
export async function upsertSettings(userId, patch) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
