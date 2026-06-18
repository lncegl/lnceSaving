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
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    heartbeatIntervalMs: 20_000,
  },
});

// ─────────────────────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────────────────────

export async function fetchTransactions(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id, type, amount, category, note, date, goal_id, created_at,
      goals ( id, name )
    `)
    .eq('user_id', userId)
    .order('date',       { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertTransaction(payload) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────

export async function fetchGoals(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error("[supabaseClient] Error fetching goals:", error);
    throw error;
  }
  return data;
}

export async function insertGoal(payload) {
  const { data, error } = await supabase
    .from('goals')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id) {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

export async function fetchOrCreateSettings(userId) {
  const { data: existing, error: readError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing;

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

export async function upsertSettings(payload) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────
// Bills
// ─────────────────────────────────────────────────────────────

/** Fetch all bills for the current user. */
export async function fetchBills(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('due_day', { ascending: true });
  if (error) throw error;
  return data;
}

/** Insert a new bill. Returns the newly created row. */
export async function insertBill(payload) {
  const { data, error } = await supabase
    .from('bills')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a bill by ID (cascades to bill_payments). */
export async function deleteBill(id) {
  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Fetch all payment records for the current user for a given month key (e.g. "2025-06"). */
export async function fetchBillPayments(userId, monthKey) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('bill_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('month_key', monthKey);
  if (error) throw error;
  return data;
}

/** Mark a bill as paid for the given month. Returns the payment row. */
export async function insertBillPayment(payload) {
  const { data, error } = await supabase
    .from('bill_payments')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a bill payment row (unmark as paid). */
export async function deleteBillPayment(id) {
  const { error } = await supabase
    .from('bill_payments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Delete all payment records for a user for a given month (full month reset). */
export async function resetBillPayments(userId, monthKey) {
  const { error } = await supabase
    .from('bill_payments')
    .delete()
    .eq('user_id', userId)
    .eq('month_key', monthKey);
  if (error) throw error;
}