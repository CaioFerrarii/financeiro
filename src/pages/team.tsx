import { useEffect, useState } from "react";
import { getMembers, updateMemberRole, removeMember } from "@/integrations/supabase/team";

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);

  async function load() {
    const data = await getMembers();
    setMembers(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, role: string) {
    await updateMemberRole(id, role);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Remover usuário da empresa?")) return;
    await removeMember(id);
    load();
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Equipe</h1>

      <div className="border rounded-lg">
        {members.map((m) => (
          <div key={m.user_id} className="flex justify-between items-center p-4 border-b">
            <div>
              <div className="font-medium">{m.email}</div>
              <div className="text-sm text-muted-foreground">{m.role}</div>
            </div>

            <div className="flex gap-2">
              <select
                value={m.role}
                onChange={(e) => changeRole(m.user_id, e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="admin">Admin</option>
                <option value="member">Membro</option>
              </select>

              <button
                onClick={() => remove(m.user_id)}
                className="text-red-500"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}