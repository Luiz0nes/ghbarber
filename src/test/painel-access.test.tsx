import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

async function guard() {
  const { Route } = await import("@/routes/_authenticated/painel");
  const beforeLoad = Route.options.beforeLoad as (a: unknown) => Promise<unknown>;
  let thrown: unknown = null;
  try {
    await beforeLoad({});
  } catch (error) {
    thrown = error;
  }
  return thrown;
}

describe("acesso ao painel do barbeiro", () => {
  beforeEach(() => rpc.mockReset());

  it("abre o painel para quem é barbeiro", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await guard()).toBeNull();
    expect(rpc).toHaveBeenCalledWith("is_barbeiro");
  });

  it("expulsa quem não é barbeiro, sem mostrar a agenda", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const thrown = await guard();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options?: { to?: string } }).options?.to).toBe("/agendar");
  });

  it("expulsa também se a checagem de papel falhar", async () => {
    rpc.mockResolvedValue({ data: true, error: new Error("boom") });
    const thrown = await guard();
    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options?: { to?: string } }).options?.to).toBe("/agendar");
  });
});
