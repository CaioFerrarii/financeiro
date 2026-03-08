import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AcceptInvite() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Validando convite...");

  useEffect(() => {
    const acceptInvite = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("token");

      if (!token) {
        setMessage("Convite inválido");
        setLoading(false);
        return;
      }

      // busca convite
      const { data: invite, error } = await supabase
        .from("invites")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !invite) {
        setMessage("Convite não encontrado ou expirado");
        setLoading(false);
        return;
      }

      // pega usuário logado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Você precisa fazer login primeiro");
        setLoading(false);
        return;
      }

      // cria vínculo na empresa
      await supabase.from("company_members").insert({
        user_id: user.id,
        company_id: invite.company_id,
        role: invite.role,
      });

      // remove convite
      await supabase.from("invites").delete().eq("id", invite.id);

      setMessage("Convite aceito! Redirecionando...");
      setTimeout(() => (window.location.href = "/"), 2000);
    };

    acceptInvite();
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center text-xl">{loading ? "Carregando..." : message}</div>
    </div>
  );
}