import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type InvitationDetails = {
  id: string;
  projectName: string;
  inviterName: string;
  email: string;
};

export type ProjectInvitationRow = {
  id: string;
  email: string;
  status: "pending" | "accepted";
  name: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolves the caller's user id from an optional bearer token. */
async function optionalUserId(): Promise<string | null> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const auth = getRequestHeader("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
  return data.user?.id ?? null;
}

/**
 * Creates (or reuses) an invitation link. Works in the demo workspace too,
 * so a session is optional; the inviter is recorded when signed in.
 */
export const createInvitation = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        projectRef: z.string().min(1).max(100),
        projectName: z.string().min(1).max(200),
        email: z.string().trim().toLowerCase().email().max(255),
        inviterName: z.string().trim().min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inviterId = await optionalUserId();

    const { data: existing } = await supabaseAdmin
      .from("project_invitations")
      .select("id")
      .eq("project_ref", data.projectRef)
      .eq("email", data.email)
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data: row, error } = await supabaseAdmin
      .from("project_invitations")
      .insert({
        project_ref: data.projectRef,
        project_name: data.projectName,
        email: data.email,
        inviter_id: inviterId,
        inviter_name: data.inviterName,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("createInvitation failed", error);
      throw new Error("Could not create invitation");
    }
    return { id: row.id };
  });

export type ProjectMemberRow = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Actual members of one project, from the project_members relationship joined
 * with profiles. This is the source of truth for Active membership.
 */
export const listProjectMembers = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ projectRef: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }): Promise<ProjectMemberRow[]> => {
    if (!UUID_RE.test(data.projectRef)) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // project_members has no direct FK to profiles, so embeds fail; fetch both
    // sides separately and merge in memory.
    const { data: rows } = await supabaseAdmin
      .from("project_members")
      .select("user_id")
      .eq("project_uuid", data.projectRef)
      .order("created_at", { ascending: true });
    const memberRows = rows ?? [];
    if (memberRows.length === 0) return [];
    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in(
        "id",
        memberRows.map((row) => row.user_id),
      );
    const profilesById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
    return memberRows.map((row) => {
      const profile = profilesById.get(row.user_id);
      const name =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
        profile?.email ||
        "Member";
      return { userId: row.user_id, name, email: profile?.email ?? "" };
    });
  });

/** Invitations of one project, used to render Pending/Active members. */
export const listProjectInvitations = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ projectRef: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data }): Promise<ProjectInvitationRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("project_invitations")
      .select("id, email, status, accepted_name, created_at")
      .eq("project_ref", data.projectRef)
      .order("created_at", { ascending: true });
    return (rows ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      status: row.status === "accepted" ? "accepted" : "pending",
      name: row.accepted_name,
    }));
  });

/** Public lookup by unguessable invitation id; returns only display fields. */
export const getInvitation = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<InvitationDetails | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("project_invitations")
      .select("id, project_name, inviter_name, email")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return null;
    return {
      id: row.id,
      projectName: row.project_name,
      inviterName: row.inviter_name,
      email: row.email,
    };
  });

/**
 * Accepts an invitation for a freshly registered user. The account must exist
 * and its email must match the invitation, so the call can't be spoofed.
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ invitationId: z.string().uuid(), userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("project_invitations")
      .select("id, email, project_ref, status")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (!invite) return { ok: false };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const user = userRes.user;
    if (!user || user.email?.toLowerCase() !== invite.email.toLowerCase()) return { ok: false };

    const meta = user.user_metadata ?? {};
    const name =
      `${String(meta["first_name"] ?? "")} ${String(meta["last_name"] ?? "")}`.trim() ||
      invite.email;

    const { error } = await supabaseAdmin
      .from("project_invitations")
      .update({
        status: "accepted",
        accepted_user_id: user.id,
        accepted_name: name,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
    if (error) return { ok: false };

    if (UUID_RE.test(invite.project_ref)) {
      const { data: project } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", invite.project_ref)
        .maybeSingle();
      if (project) {
        const { data: already } = await supabaseAdmin
          .from("project_members")
          .select("id")
          .eq("project_uuid", project.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!already) {
          await supabaseAdmin
            .from("project_members")
            .insert({ project_uuid: project.id, user_id: user.id });
        }
      }
    }

    // The invitation already joined the user to their project, so the
    // Project ID onboarding step (/member) must be skipped on first login.
    await supabaseAdmin
      .from("profiles")
      .update({ setup_complete: true })
      .eq("id", user.id);

    return { ok: true };
  });
