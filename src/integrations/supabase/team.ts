import { supabase } from "./client";

export async function getMembers() {
  const { data, error } = await supabase.rpc("get_company_members");

  if (error) throw error;
  return data;
}

export async function updateMemberRole(userId: string, role: string) {
  const { error } = await supabase.rpc("update_member_role", {
    target_user: userId,
    new_role: role,
  });

  if (error) throw error;
}

export async function removeMember(userId: string) {
  const { error } = await supabase.rpc("remove_member", {
    target_user: userId,
  });

  if (error) throw error;
}