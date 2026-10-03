// supabase/functions/send-release-disclosure-link/index.ts
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
async function sendWhatsAppWithoutBlocking(serviceClient, input) {
  try {
    return await sendTransactionalWhatsApp(serviceClient, input);
  } catch (error) {
    console.error("Release disclosure WhatsApp delivery failed.", error);
    return "failed";
  }
}
var corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors(req) });
  }
  try {
    if (req.method !== "POST") throw new Error("Method not allowed.");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header.");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin = getAllowedOrigin(req);
    if (!appOrigin) throw new Error("No trusted app origin is configured.");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("User is not authenticated.");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: admin, error: adminError } = await serviceClient.from("app_admins").select("user_id").eq("user_id", userData.user.id).eq("is_active", true).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) throw new Error("Admin access required.");
    const { caseId, expiryHours = 72 } = await req.json();
    if (!caseId) throw new Error("Missing caseId.");
    const { data: releaseCase, error: caseError } = await serviceClient.from("emergency_release_cases").select("id,user_id,status").eq("id", caseId).maybeSingle();
    if (caseError) throw caseError;
    if (!releaseCase) throw new Error("Emergency release case not found.");
    if (!["ready_for_release", "released"].includes(releaseCase.status)) {
      throw new Error("Case must be ready for release or released before links are emailed.");
    }
    const { data: owner, error: ownerError } = await serviceClient.from("profiles").select("full_name").eq("id", releaseCase.user_id).maybeSingle();
    if (ownerError) throw ownerError;
    const { data: packages, error: packageError } = await userClient.rpc(
      "admin_prepare_emergency_release_disclosures",
      {
        p_case_id: caseId,
        p_expiry_hours: Math.max(1, Number(expiryHours) || 72)
      }
    );
    if (packageError) throw packageError;
    const template = getEmailTemplate("emergency_release_link");
    const results = [];
    for (const releasePackage of packages || []) {
      const { data: approval, error: approvalError } = await serviceClient.from("emergency_release_approvals").select(
        "id,status,safe_circle_members(id,name,email,phone,phone_normalized,phone_verified_at,whatsapp_opt_in,whatsapp_locale)"
      ).eq("case_id", caseId).eq("member_id", releasePackage.member_id).eq("status", "approved").maybeSingle();
      if (approvalError) throw approvalError;
      const member = approval?.safe_circle_members || {};
      const recipient = String(member.email || "").trim().toLowerCase();
      const accessToken = String(releasePackage.access_token || "");
      const tokenHash = await sha256Hex(accessToken);
      const accessUrl = `${appOrigin}/?releaseToken=${encodeURIComponent(accessToken)}`;
      const idempotencyKey = `emergency_release_link:${caseId}:${releasePackage.member_id}:${tokenHash}`;
      const { data: disclosures, error: disclosuresError } = await serviceClient.from("emergency_release_disclosures").select("id,status,secure_link_expires_at,revoked_at,recipient_contact").eq("case_id", caseId).eq("member_id", releasePackage.member_id).eq("access_token_hash", tokenHash);
      if (disclosuresError) throw disclosuresError;
      const validDisclosures = (disclosures || []).filter(
        (row) => !row.revoked_at && row.secure_link_expires_at && new Date(row.secure_link_expires_at).getTime() > Date.now()
      );
      let whatsappStatus = "suppressed";
      if (approval && accessToken && validDisclosures.length > 0) {
        whatsappStatus = await sendWhatsAppWithoutBlocking(serviceClient, {
          userId: releaseCase.user_id,
          recipientType: "member",
          recipientId: releasePackage.member_id,
          recipient: member,
          category: "emergency",
          scenario: "whatsapp_emergency_release_link",
          relatedEntityType: "emergency_release_disclosure_package",
          relatedEntityId: tokenHash,
          idempotencyKey: `whatsapp_emergency_release_link:${caseId}:${releasePackage.member_id}:${tokenHash}`,
          bodyValues: [
            owner?.full_name || "SafeCircle account owner",
            member.name || "Trusted member",
            releasePackage.expires_at,
            releasePackage.disclosure_count
          ],
          buttonUrlSuffix: accessToken,
          metadata: {
            case_id: caseId,
            member_id: releasePackage.member_id,
            disclosure_count: releasePackage.disclosure_count,
            expires_at: releasePackage.expires_at
          },
          requireCategoryPreference: false
        });
        if (whatsappStatus === "sent") {
          await serviceClient.from("emergency_release_disclosures").update({ status: "sent" }).eq("case_id", caseId).eq("member_id", releasePackage.member_id).eq("access_token_hash", tokenHash);
        }
      }
      const { delivery, shouldSend } = await createQueuedDelivery(serviceClient, {
        userId: releaseCase.user_id,
        recipientType: "member",
        recipientId: releasePackage.member_id,
        channel: "email",
        scenario: "emergency_release_link",
        template: template.id,
        recipient: recipient || "missing",
        relatedEntityType: "emergency_release_disclosure_package",
        relatedEntityId: tokenHash,
        idempotencyKey,
        metadata: {
          case_id: caseId,
          member_id: releasePackage.member_id,
          disclosure_count: releasePackage.disclosure_count,
          expires_at: releasePackage.expires_at
        }
      });
      if (!approval || !recipient) {
        await markDeliverySuppressed(
          serviceClient,
          delivery.id,
          !approval ? "Recipient is not an approved nominee." : "Approved nominee has no email address."
        );
        results.push({
          ...releasePackage,
          access_url: accessUrl,
          delivery_status: "suppressed",
          whatsapp_status: whatsappStatus
        });
        continue;
      }
      if (!accessToken || validDisclosures.length === 0) {
        await markDeliverySuppressed(
          serviceClient,
          delivery.id,
          "Release token is missing, expired, revoked, or has no prepared disclosures."
        );
        results.push({
          ...releasePackage,
          access_url: accessUrl,
          delivery_status: "suppressed",
          whatsapp_status: whatsappStatus
        });
        continue;
      }
      if (!shouldSend) {
        results.push({
          ...releasePackage,
          access_url: accessUrl,
          delivery_status: delivery.status,
          whatsapp_status: whatsappStatus
        });
        continue;
      }
      try {
        const sendResult = await sendEmail({
          template: template.id,
          subject: template.subject,
          to: recipient,
          variables: {
            owner_name: owner?.full_name || "SafeCircle account owner",
            member_name: member.name || "",
            release_url: accessUrl,
            expires_at: releasePackage.expires_at,
            disclosure_count: releasePackage.disclosure_count,
            case_status: releaseCase.status,
            case_id: caseId
          },
          scenario: "emergency_release_link",
          idempotencyKey
        });
        await markDeliverySent(
          serviceClient,
          delivery.id,
          sendResult.provider,
          sendResult.messageId
        );
        await serviceClient.from("emergency_release_disclosures").update({ status: "sent" }).eq("case_id", caseId).eq("member_id", releasePackage.member_id).eq("access_token_hash", tokenHash);
        results.push({
          ...releasePackage,
          access_url: accessUrl,
          delivery_status: "sent",
          whatsapp_status: whatsappStatus
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markDeliveryFailed(serviceClient, delivery.id, message);
        results.push({
          ...releasePackage,
          access_url: accessUrl,
          delivery_status: "failed",
          delivery_error: message,
          whatsapp_status: whatsappStatus
        });
      }
    }
    return new Response(
      JSON.stringify({
        ok: true,
        packages: results,
        sent: results.filter((row) => row.delivery_status === "sent").length,
        failed: results.filter((row) => row.delivery_status === "failed").length,
        suppressed: results.filter((row) => row.delivery_status === "suppressed").length
      }),
      { headers: withCors(req, { "Content-Type": "application/json" }) }
    );
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
