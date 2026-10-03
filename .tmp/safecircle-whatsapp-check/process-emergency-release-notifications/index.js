// supabase/functions/process-emergency-release-notifications/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  createQueuedDelivery,
  markDeliveryFailed,
  markDeliverySent,
  markDeliverySuppressed
} from "../_shared/notificationDeliveries.ts";
import { getEmailTemplate } from "../_shared/providers/emailTemplates.ts";
import { sendEmail } from "../_shared/providers/emailProvider.ts";
import { sendTransactionalWhatsApp } from "../_shared/sendTransactionalWhatsApp.ts";
async function sendWhatsAppWithoutBlocking(supabase, input) {
  try {
    return await sendTransactionalWhatsApp(supabase, input);
  } catch (error) {
    console.error("Emergency WhatsApp delivery failed.", error);
    return "failed";
  }
}
var corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-emergency-notification-secret"
};
function configuredOrigins() {
  return [
    Deno.env.get("PUBLIC_APP_ORIGIN") || "",
    Deno.env.get("PUBLIC_NETLIFY_ORIGIN") || "",
    Deno.env.get("LOCAL_DH_NGROK_ORIGIN") || "",
    Deno.env.get("PUBLIC_ALLOWED_APP_ORIGINS") || ""
  ].flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}
function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch (_error) {
    return "";
  }
}
function wildcardOriginMatches(pattern, origin) {
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+");
  return new RegExp(`^${escapedPattern}$`).test(origin);
}
function getAllowedOrigin(req) {
  const requestOrigin = normalizeOrigin(req.headers.get("Origin"));
  const isAllowed = configuredOrigins().some((allowedOrigin) => {
    const normalized = normalizeOrigin(allowedOrigin);
    if (normalized && normalized === requestOrigin) return true;
    return allowedOrigin.includes("*") && wildcardOriginMatches(allowedOrigin, requestOrigin);
  });
  return isAllowed ? requestOrigin : normalizeOrigin(Deno.env.get("PUBLIC_APP_ORIGIN") || "");
}
function withCors(req, headers = {}) {
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": getAllowedOrigin(req) || "null",
    ...headers
  };
}
async function requireAuthorizedCaller(req, supabaseUrl, anonKey, serviceClient) {
  const configuredSecret = Deno.env.get("EMERGENCY_NOTIFICATION_SECRET") || "";
  const suppliedSecret = req.headers.get("x-emergency-notification-secret") || "";
  if (configuredSecret && suppliedSecret === configuredSecret) return;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Admin authentication or scheduler secret required.");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("User is not authenticated.");
  const { data: admin, error: adminError } = await serviceClient.from("app_admins").select("user_id").eq("user_id", userData.user.id).eq("is_active", true).maybeSingle();
  if (adminError) throw adminError;
  if (!admin) throw new Error("Admin access required.");
}
async function sendTrackedEmail(supabase, input) {
  const template = getEmailTemplate(input.scenario);
  const { delivery, shouldSend } = await createQueuedDelivery(supabase, {
    userId: input.userId,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    channel: "email",
    scenario: input.scenario,
    template: template.id,
    recipient: input.recipient || "missing",
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata
  });
  if (!input.recipient) {
    await markDeliverySuppressed(supabase, delivery.id, "Email recipient is missing.");
    return "suppressed";
  }
  if (!shouldSend) return delivery.status;
  try {
    const result = await sendEmail({
      template: template.id,
      subject: template.subject,
      to: input.recipient,
      variables: input.variables,
      scenario: input.scenario,
      idempotencyKey: input.idempotencyKey
    });
    await markDeliverySent(supabase, delivery.id, result.provider, result.messageId);
    return "sent";
  } catch (error) {
    await markDeliveryFailed(
      supabase,
      delivery.id,
      error instanceof Error ? error.message : String(error)
    );
    return "failed";
  }
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors(req) });
  }
  try {
    if (req.method !== "POST") throw new Error("Method not allowed.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin = getAllowedOrigin(req);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await requireAuthorizedCaller(req, supabaseUrl, anonKey, supabase);
    const body = await req.json().catch(() => ({}));
    if (body.evaluate === true) {
      const { error: queueError } = await supabase.rpc("queue_emergency_release_cases");
      if (queueError) throw queueError;
      const { error: advanceError } = await supabase.rpc("advance_emergency_release_cases");
      if (advanceError) throw advanceError;
    }
    let caseQuery = supabase.from("emergency_release_cases").select("*, release_rules(notify_members_on_missed)").in("status", [
      "grace_period",
      "awaiting_nominee_approval",
      "manual_review",
      "ready_for_release"
    ]).order("created_at", { ascending: true });
    if (body.caseId) caseQuery = caseQuery.eq("id", body.caseId);
    const { data: cases, error: casesError } = await caseQuery;
    if (casesError) throw casesError;
    const { data: adminRows, error: adminsError } = await supabase.from("app_admins").select("user_id").eq("is_active", true);
    if (adminsError) throw adminsError;
    const adminIds = (adminRows || []).map((row) => row.user_id);
    const { data: adminProfiles, error: adminProfilesError } = adminIds.length ? await supabase.from("profiles").select(
      "id,full_name,email,phone,phone_normalized,phone_verified_at,whatsapp_opt_in,whatsapp_locale,whatsapp_preferences"
    ).in("id", adminIds) : { data: [], error: null };
    if (adminProfilesError) throw adminProfilesError;
    const summary = { sent: 0, failed: 0, suppressed: 0, skipped: 0 };
    const recordResult = (status) => {
      if (status === "sent") summary.sent += 1;
      else if (status === "failed") summary.failed += 1;
      else if (status === "suppressed") summary.suppressed += 1;
      else summary.skipped += 1;
    };
    for (const releaseCase of cases || []) {
      const { data: owner, error: ownerError } = await supabase.from("profiles").select(
        "id,full_name,email,phone,phone_normalized,phone_verified_at,whatsapp_opt_in,whatsapp_locale,whatsapp_preferences"
      ).eq("id", releaseCase.user_id).maybeSingle();
      if (ownerError) throw ownerError;
      if (releaseCase.status === "grace_period") {
        recordResult(await sendTrackedEmail(supabase, {
          userId: releaseCase.user_id,
          recipientType: "owner",
          recipientId: releaseCase.user_id,
          recipient: owner?.email || "",
          scenario: "emergency_owner_grace_started",
          relatedEntityType: "emergency_release_case",
          relatedEntityId: releaseCase.id,
          idempotencyKey: `emergency_owner_grace_started:${releaseCase.id}`,
          variables: {
            first_name: owner?.full_name || "",
            grace_period_ends_at: releaseCase.grace_period_ends_at || "",
            last_checkin_at: releaseCase.last_checkin_at || "",
            checkin_url: appOrigin,
            case_id: releaseCase.id
          }
        }));
        if (owner) {
          recordResult(await sendWhatsAppWithoutBlocking(supabase, {
            userId: releaseCase.user_id,
            recipientType: "owner",
            recipientId: releaseCase.user_id,
            recipient: owner,
            category: "emergency",
            scenario: "whatsapp_emergency_owner_grace_started",
            relatedEntityType: "emergency_release_case",
            relatedEntityId: releaseCase.id,
            idempotencyKey: `whatsapp_emergency_owner_grace_started:${releaseCase.id}`,
            bodyValues: [
              owner.full_name || "SafeCircle account owner",
              releaseCase.grace_period_ends_at || "",
              releaseCase.id
            ],
            metadata: {
              case_status: releaseCase.status,
              grace_period_ends_at: releaseCase.grace_period_ends_at
            }
          }));
        }
      }
      if (releaseCase.status === "awaiting_nominee_approval") {
        const notifyMembers = releaseCase.release_rules?.notify_members_on_missed !== false;
        const { data: approvals, error: approvalsError } = await supabase.from("emergency_release_approvals").select(
          "id,member_id,status,safe_circle_members(id,name,email,phone,phone_normalized,phone_verified_at,relationship,whatsapp_opt_in,whatsapp_locale)"
        ).eq("case_id", releaseCase.id).eq("status", "pending");
        if (approvalsError) throw approvalsError;
        for (const approval of approvals || []) {
          const member = approval.safe_circle_members || {};
          if (!notifyMembers) {
            recordResult(await sendTrackedEmail(supabase, {
              userId: releaseCase.user_id,
              recipientType: "member",
              recipientId: member.id || approval.member_id,
              recipient: "",
              scenario: "emergency_nominee_approval_request",
              relatedEntityType: "emergency_release_approval",
              relatedEntityId: approval.id,
              idempotencyKey: `emergency_nominee_approval_request:${approval.id}`,
              variables: {},
              metadata: { suppressed_by_release_rule: true }
            }));
            continue;
          }
          recordResult(await sendTrackedEmail(supabase, {
            userId: releaseCase.user_id,
            recipientType: "member",
            recipientId: member.id || approval.member_id,
            recipient: member.email || "",
            scenario: "emergency_nominee_approval_request",
            relatedEntityType: "emergency_release_approval",
            relatedEntityId: approval.id,
            idempotencyKey: `emergency_nominee_approval_request:${approval.id}`,
            variables: {
              owner_name: owner?.full_name || "SafeCircle member",
              member_name: member.name || "",
              relationship: member.relationship || "",
              case_id: releaseCase.id,
              support_url: appOrigin,
              action_required: "Contact SafeCircle support or the account owner. Online nominee approval is not yet enabled."
            },
            metadata: { approval_process: "admin_manual" }
          }));
          recordResult(await sendWhatsAppWithoutBlocking(supabase, {
            userId: releaseCase.user_id,
            recipientType: "member",
            recipientId: member.id || approval.member_id,
            recipient: member,
            category: "emergency",
            scenario: "whatsapp_emergency_nominee_approval_request",
            relatedEntityType: "emergency_release_approval",
            relatedEntityId: approval.id,
            idempotencyKey: `whatsapp_emergency_nominee_approval_request:${approval.id}`,
            bodyValues: [
              member.name || "Trusted member",
              owner?.full_name || "SafeCircle account owner",
              releaseCase.id
            ],
            metadata: {
              case_id: releaseCase.id,
              approval_process: "admin_manual"
            },
            requireCategoryPreference: false
          }));
        }
      }
      if (["manual_review", "ready_for_release"].includes(releaseCase.status)) {
        const scenario = releaseCase.status === "manual_review" ? "emergency_manual_review" : "emergency_ready_for_release";
        for (const admin of adminProfiles || []) {
          recordResult(await sendTrackedEmail(supabase, {
            userId: releaseCase.user_id,
            recipientType: "admin",
            recipientId: admin.id,
            recipient: admin.email || "",
            scenario,
            relatedEntityType: "emergency_release_case",
            relatedEntityId: releaseCase.id,
            idempotencyKey: `${scenario}:${releaseCase.id}:${admin.id}`,
            variables: {
              admin_name: admin.full_name || "",
              owner_name: owner?.full_name || "",
              case_id: releaseCase.id,
              case_status: releaseCase.status,
              approvals_received: releaseCase.approvals_received || 0,
              approvals_required: releaseCase.approvals_required || 1,
              admin_url: appOrigin
            }
          }));
          recordResult(await sendWhatsAppWithoutBlocking(supabase, {
            userId: releaseCase.user_id,
            recipientType: "admin",
            recipientId: admin.id,
            recipient: admin,
            category: "emergency",
            scenario: "whatsapp_security_notice",
            relatedEntityType: "emergency_release_case",
            relatedEntityId: releaseCase.id,
            idempotencyKey: `whatsapp_security_notice:${scenario}:${releaseCase.id}:${admin.id}`,
            bodyValues: [
              admin.full_name || "SafeCircle administrator",
              scenario,
              owner?.full_name || "SafeCircle account owner",
              releaseCase.id
            ],
            metadata: {
              case_status: releaseCase.status,
              approvals_received: releaseCase.approvals_received || 0,
              approvals_required: releaseCase.approvals_required || 1
            }
          }));
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, cases: cases?.length || 0, ...summary }), {
      headers: withCors(req, { "Content-Type": "application/json" })
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 400,
        headers: withCors(req, { "Content-Type": "application/json" })
      }
    );
  }
});
