import { supabase } from "@/integrations/supabase/client";

const SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || undefined;

async function callPublic<T = any>(action: string, payload: any = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("public-api", {
    body: { action, payload, schema: SCHEMA },
  });
  if (error) {
    // Try to extract structured error message from edge function response
    const ctx: any = (error as any).context;
    let msg = error.message;
    try {
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {}
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

async function callAdmin<T = any>(action: string, payload: any = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, payload, schema: SCHEMA },
  });
  if (error) {
    const ctx: any = (error as any).context;
    let msg = error.message;
    try {
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch {}
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

// ---- Public API ----
export const getPublicConfig = () =>
  callPublic<{
    nome_plataforma: string | null;
    logo_url: string | null;
    whatsapp_clinica: string | null;
    whatsapp_mensagem: string | null;
  } | null>("getPublicConfig");

export const cadastrarIndicador = (data: { nome: string; telefone: string }) =>
  callPublic<{ magic_token: string; codigo: string; novo: boolean }>("cadastrarIndicador", data);

export const entrarPorTelefone = (data: { telefone: string }) =>
  callPublic<{ magic_token: string }>("entrarPorTelefone", data);

export const getPainel = (data: { token: string }) =>
  callPublic<{
    indicador: { id: string; nome: string; codigo_indicacao: string; telefone: string; created_at: string };
    indicacoes: Array<{ id: string; nome_indicado: string; status: string; created_at: string }>;
  }>("getPainel", data);

export const getIndicadorPorCodigo = (data: {
  codigo: string;
  registrarClique?: boolean;
  userAgent?: string;
}) => callPublic<{ id: string; nome: string }>("getIndicadorPorCodigo", data);

export const submitIndicacao = (data: { codigo: string; nome: string; telefone: string }) =>
  callPublic<{ ok: boolean; duplicado: boolean; whatsappUrl: string | null }>(
    "submitIndicacao",
    data,
  );

// ---- Admin API (requires logged-in admin) ----
export const adminDashboard = () =>
  callAdmin<{
    totalIndicadores: number;
    totalIndicacoes: number;
    totalConvertidos: number;
    ranking: Array<{ id: string; nome: string; total: number }>;
  }>("adminDashboard");

export const listarIndicadores = () =>
  callAdmin<Array<{
    id: string;
    nome: string;
    telefone: string;
    codigo_indicacao: string;
    created_at: string;
    total: number;
    convertidos: number;
    pontos_consumidos: number;
  }>>("listarIndicadores");

export const premiarIndicador = (data: { indicador_id: string; pontos: number; comentario: string }) =>
  callAdmin<{ ok: true }>("premiarIndicador", data);

export const listarIndicacoes = () =>
  callAdmin<Array<any>>("listarIndicacoes");

export const getConfigKommo = () =>
  callAdmin<{
    subdomain: string | null;
    bearer_token: string | null;
    pipeline_id: number | null;
    stage_id: number | null;
    whatsapp_clinica: string | null;
    whatsapp_mensagem: string | null;
    nome_plataforma: string | null;
    logo_url: string | null;
  } | null>("getConfigKommo");

export const salvarConfigKommo = (data: {
  subdomain?: string | null;
  bearer_token?: string | null;
  pipeline_id?: number | null;
  stage_id?: number | null;
  whatsapp_clinica?: string | null;
  whatsapp_mensagem?: string | null;
  nome_plataforma?: string;
  logo_url?: string | null;
}) => callAdmin<{ ok: true }>("salvarConfigKommo", data);

export const testarConfigKommo = () =>
  callAdmin<{ ok: boolean; error?: string }>("testarConfigKommo");

export const atualizarStatus = (data: { id: string; status: string }) =>
  callAdmin<{ ok: true }>("atualizarStatus", data);

export const syncKommoLeads = () =>
  callAdmin<{ ok: true; synced: number }>("syncKommoLeads");
