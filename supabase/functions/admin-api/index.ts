// Edge function: admin-api
// Requires authenticated user with role 'admin'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Kommo helpers (subset; sync/test need it) ----
type KommoConfig = { subdomain: string; bearer_token: string; pipeline_id: number | null; stage_id: number | null };
const kommoHeaders = (c: KommoConfig) => ({ Authorization: `Bearer ${c.bearer_token}`, "Content-Type": "application/json" });
const kommoUrl = (c: KommoConfig) => `https://${c.subdomain}.kommo.com/api/v4`;

async function testarConexaoKommo(c: KommoConfig) {
  try {
    const res = await fetch(`${kommoUrl(c)}/account`, { headers: kommoHeaders(c) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
async function getPipelines(c: KommoConfig) {
  const res = await fetch(`${kommoUrl(c)}/leads/pipelines`, { headers: kommoHeaders(c) });
  if (!res.ok) throw new Error(`Kommo get pipelines ${res.status}`);
  const data = await res.json();
  return data?._embedded?.pipelines ?? [];
}
async function getLeadStatus(c: KommoConfig, leadId: number) {
  const res = await fetch(`${kommoUrl(c)}/leads/${leadId}`, { headers: kommoHeaders(c) });
  if (!res.ok) throw new Error(`Kommo get lead ${res.status}`);
  const data = await res.json();
  return { status_id: data.status_id };
}

async function handle(action: string, payload: any, admin: any) {
  switch (action) {
    case "adminDashboard": {
      const [{ count: totalInd }, { count: totalIndic }, { count: totalConv }] = await Promise.all([
        admin.from("indicadores").select("*", { count: "exact", head: true }),
        admin.from("indicacoes").select("*", { count: "exact", head: true }),
        admin.from("indicacoes").select("*", { count: "exact", head: true }).eq("status", "convertido"),
      ]);
      const { data: ranking } = await admin
        .from("indicadores").select("id, nome, indicacoes(count)").limit(50);
      const rankingArr = (ranking ?? [])
        .map((r: any) => ({ id: r.id, nome: r.nome, total: r.indicacoes?.[0]?.count ?? 0 }))
        .sort((a: any, b: any) => b.total - a.total).slice(0, 5);
      return {
        totalIndicadores: totalInd ?? 0,
        totalIndicacoes: totalIndic ?? 0,
        totalConvertidos: totalConv ?? 0,
        ranking: rankingArr,
      };
    }
    case "listarIndicadores": {
      const { data: indicadores } = await admin
        .from("indicadores")
        .select("id, nome, telefone, codigo_indicacao, created_at")
        .order("created_at", { ascending: false });
      const ids = (indicadores ?? []).map((i: any) => i.id);
      const counts: Record<string, { total: number; convertidos: number; pontos_consumidos: number }> = {};
      if (ids.length) {
        const [{ data: rowsIndicacoes }, { data: rowsPremios }] = await Promise.all([
          admin.from("indicacoes").select("indicador_id, status").in("indicador_id", ids),
          admin.from("premios").select("indicador_id, pontos_consumidos").in("indicador_id", ids),
        ]);
        
        for (const r of rowsIndicacoes ?? []) {
          const k = r.indicador_id as string;
          counts[k] ??= { total: 0, convertidos: 0, pontos_consumidos: 0 };
          counts[k].total++;
          if (r.status === "convertido") counts[k].convertidos++;
        }
        for (const r of rowsPremios ?? []) {
          const k = r.indicador_id as string;
          counts[k] ??= { total: 0, convertidos: 0, pontos_consumidos: 0 };
          counts[k].pontos_consumidos += r.pontos_consumidos;
        }
      }
      return (indicadores ?? []).map((i: any) => ({
        ...i,
        total: counts[i.id]?.total ?? 0,
        convertidos: counts[i.id]?.convertidos ?? 0,
        pontos_consumidos: counts[i.id]?.pontos_consumidos ?? 0,
      }));
    }
    case "premiarIndicador": {
      const { indicador_id, pontos, comentario } = payload;
      if (!indicador_id || !pontos || pontos <= 0) throw new Error("Dados inválidos.");
      
      const { error } = await admin.from("premios").insert({
        indicador_id,
        pontos_consumidos: pontos,
        comentario
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "listarIndicacoes": {
      const { data } = await admin
        .from("indicacoes")
        .select("id, nome_indicado, telefone_indicado, status, kommo_lead_id, kommo_status, created_at, indicador:indicadores(nome)")
        .order("created_at", { ascending: false });
      return data ?? [];
    }
    case "getConfigKommo": {
      const { data } = await admin
        .from("configuracoes_kommo")
        .select("subdomain, bearer_token, pipeline_id, stage_id, whatsapp_clinica, whatsapp_mensagem, nome_plataforma, logo_url")
        .eq("id", 1).maybeSingle();
      return data;
    }
    case "salvarConfigKommo": {
      const { error } = await admin.from("configuracoes_kommo").upsert({
        id: 1,
        subdomain: payload.subdomain?.trim() ? payload.subdomain.trim() : null,
        bearer_token: payload.bearer_token?.trim() ? payload.bearer_token.trim() : null,
        pipeline_id: payload.pipeline_id ? Number(payload.pipeline_id) : null,
        stage_id: payload.stage_id ? Number(payload.stage_id) : null,
        whatsapp_clinica: payload.whatsapp_clinica?.trim() ? payload.whatsapp_clinica.trim() : null,
        whatsapp_mensagem: payload.whatsapp_mensagem ?? null,
        nome_plataforma: payload.nome_plataforma ?? null,
        logo_url: payload.logo_url ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "testarConfigKommo": {
      const { data } = await admin
        .from("configuracoes_kommo")
        .select("subdomain, bearer_token, pipeline_id, stage_id").eq("id", 1).maybeSingle();
      if (!data?.subdomain || !data?.bearer_token) return { ok: false, error: "Configuração incompleta." };
      return await testarConexaoKommo(data as KommoConfig);
    }
    case "atualizarStatus": {
      const ok = ["recebido", "em_contato", "compareceu", "convertido", "encerrado"].includes(payload.status);
      if (!ok) throw new Error("Status inválido.");
      const { error } = await admin.from("indicacoes").update({ status: payload.status }).eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "syncKommoLeads": {
      const { data: cfg } = await admin
        .from("configuracoes_kommo")
        .select("subdomain, bearer_token, pipeline_id, stage_id").eq("id", 1).maybeSingle();
      if (!cfg?.subdomain || !cfg?.bearer_token) throw new Error("Kommo não configurado.");
      const { data: indicacoes } = await admin
        .from("indicacoes").select("id, kommo_lead_id")
        .not("kommo_lead_id", "is", null)
        .or(`kommo_updated_at.is.null,kommo_updated_at.lt.${new Date(Date.now() - 3600000).toISOString()}`)
        .limit(50);
      if (!indicacoes?.length) return { ok: true, synced: 0 };
      const pipelines = await getPipelines(cfg as KommoConfig);
      const statusMap: Record<number, string> = {};
      for (const p of pipelines) for (const s of p._embedded?.statuses ?? []) statusMap[s.id] = s.name;
      let synced = 0;
      for (const ind of indicacoes) {
        try {
          const { status_id } = await getLeadStatus(cfg as KommoConfig, ind.kommo_lead_id!);
          await admin.from("indicacoes").update({
            kommo_status: statusMap[status_id] || `ID: ${status_id}`,
            kommo_updated_at: new Date().toISOString(),
          }).eq("id", ind.id);
          synced++;
        } catch (e) {
          console.error(`Sync error for lead ${ind.kommo_lead_id}:`, e);
        }
      }
      return { ok: true, synced };
    }
    default:
      throw new Error(`Ação desconhecida: ${action}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autenticação.");

    // Read body once (stream can only be consumed once)
    const { action, payload, schema } = await req.json();

    // Verify the user with the publishable key + auth header
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Sessão inválida.");

    // Admin client on public schema for auth check (has_role lives in public)
    const adminPublic = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Toda conta autenticada é considerada equipe da clínica e tem acesso ao /admin.
    // Garantimos a role admin (best-effort) e liberamos o acesso para qualquer sessão válida.
    const { error: roleErr } = await adminPublic
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr) console.error("user_roles upsert:", roleErr.message);


    // Data client — uses tenant schema if provided
    const dbSchema = schema && schema !== "public" ? schema : undefined;
    const clientOpts: any = {};
    if (dbSchema) clientOpts.db = { schema: dbSchema };
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      clientOpts,
    );

    const result = await handle(action, payload ?? {}, admin);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
