import { supabase } from "@/integrations/supabase/client";

export type SavedPlanMeta = {
  id: string;
  name: string;
  patient_name: string | null;
  updated_at: string;
  expires_at: string;
};

export type SavedPlan = SavedPlanMeta & { data: unknown };

/** All plans (kept indefinitely — see the saved_plans_no_expiry migration), newest first. */
export async function listSavedPlans(): Promise<SavedPlanMeta[]> {
  const { data, error } = await supabase
    .from("saved_plans")
    .select("id, name, patient_name, updated_at, expires_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as SavedPlanMeta[];
}

export async function loadSavedPlan(id: string): Promise<SavedPlan> {
  const { data, error } = await supabase
    .from("saved_plans")
    .select("id, name, patient_name, updated_at, expires_at, data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This plan is no longer available.");
  return data as SavedPlan;
}

export async function createSavedPlan(
  name: string,
  patientName: string,
  data: unknown,
): Promise<string> {
  const { data: row, error } = await supabase
    .from("saved_plans")
    .insert({ name, patient_name: patientName, data: data as never })
    .select("id")
    .single();
  if (error) throw error;
  return row.id as string;
}

export async function updateSavedPlan(
  id: string,
  name: string,
  patientName: string,
  data: unknown,
): Promise<void> {
  // .select() so we can tell when the update silently matched no row (e.g. a
  // row-level-security rule) — that used to look like a successful save.
  const { data: rows, error } = await supabase
    .from("saved_plans")
    .update({ name, patient_name: patientName, data: data as never })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!rows || rows.length === 0) {
    throw new Error("The server did not accept the save (plan not found or no permission).");
  }
}

/** Last-updated time (ms) of a cloud plan, or null if it no longer exists. */
export async function getSavedPlanUpdatedAt(id: string): Promise<number | null> {
  const { data, error } = await supabase.from("saved_plans").select("updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? new Date(data.updated_at as string).getTime() : null;
}

export async function deleteSavedPlan(id: string): Promise<void> {
  const { error } = await supabase.from("saved_plans").delete().eq("id", id);
  if (error) throw error;
}
