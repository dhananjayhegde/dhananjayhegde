// supabase/functions/send-member-invite/index.ts
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
    console.error("Member invite WhatsApp delivery failed.", error);
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
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return configuredOrigins().some((allowedOrigin) => {
    const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
    if (normalizedAllowedOrigin && normalizedAllowedOrigin === origin) return true;
    return allowedOrigin.includes("*") && wildcardOriginMatches(allowedOrigin, origin);
  });
}
function getTrustedRequestOrigin(req) {
  const requestOrigin = normalizeOrigin(req.headers.get("Origin"));
  if (isAllowedOrigin(requestOrigin)) return requestOrigin;
  return normalizeOrigin(Deno.env.get("PUBLIC_APP_ORIGIN") || "");
}
function withCors(req, headers = {}) {
  const allowedOrigin = getTrustedRequestOrigin(req);
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    ...headers
  };
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin = getTrustedRequestOrigin(req);
    if (!appOrigin) {
      throw new Error(
        "No trusted app origin is configured for member invite links."
      );
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("User is not authenticated.");
    const { inviteId } = await req.json();
    if (!inviteId) throw new Error("Missing inviteId.");
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: invite, error: inviteError } = await supabase.from("member_invites").select(
      "*, safe_circle_members(id,name,email,phone,phone_normalized,phone_verified_at,relationship,whatsapp_opt_in,whatsapp_locale)"
    ).eq("id", inviteId).eq("user_id", userData.user.id).maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) throw new Error("Invite not found.");
    const { data: owner, error: ownerError } = await supabase.from("profiles").select("full_name,email").eq("id", userData.user.id).maybeSingle();
    if (ownerError) throw ownerError;
    const member = invite.safe_circle_members || {};
    const recipient = member.email || invite.email || "";
    const template = getEmailTemplate("member_invite");
    const inviteUrl = `${appOrigin}/?invite=${encodeURIComponent(invite.invite_token)}`;
    const idempotencyKey = `member_invite:${invite.id}`;
    if (member.phone_verified_at && member.whatsapp_opt_in) {
      await sendWhatsAppWithoutBlocking(supabase, {
        userId: userData.user.id,
        recipientType: "member",
        recipientId: member.id || invite.member_id,
        recipient: member,
        category: "security",
        scenario: "whatsapp_member_invite",
        relatedEntityType: "member_invite",
        relatedEntityId: invite.id,
        idempotencyKey: `whatsapp_member_invite:${invite.id}`,
        bodyValues: [
          owner?.full_name || owner?.email || "A SafeCircle user",
          member.name || "Family member",
          member.relationship || ""
        ],
        buttonUrlSuffix: String(invite.invite_token),
        metadata: {
          member_id: member.id || invite.member_id,
          invite_status: invite.status
        },
        requireCategoryPreference: false
      });
    }
    const { delivery, shouldSend } = await createQueuedDelivery(supabase, {
      userId: userData.user.id,
      recipientType: "member",
      recipientId: member.id || invite.member_id,
      channel: "email",
      scenario: "member_invite",
      template: template.id,
      recipient: recipient || "missing",
      relatedEntityType: "member_invite",
      relatedEntityId: invite.id,
      idempotencyKey,
      metadata: {
        member_id: member.id || invite.member_id,
        invite_status: invite.status
      }
    });
    if (!recipient) {
      await markDeliverySuppressed(supabase, delivery.id, "Member invite has no email recipient.");
      await supabase.from("member_invites").update({ status: "email_missing" }).eq("id", invite.id);
      await supabase.from("safe_circle_members").update({ invite_status: "email_missing" }).eq("id", invite.member_id).eq("user_id", userData.user.id);
      return new Response(
        JSON.stringify({ ok: true, sent: false, suppressed: true, reason: "missing_email" }),
        { headers: withCors(req, { "Content-Type": "application/json" }) }
      );
    }
    if (!shouldSend) {
      return new Response(
        JSON.stringify({
          ok: true,
          sent: false,
          already_sent: delivery.status === "sent",
          delivery
        }),
        { headers: withCors(req, { "Content-Type": "application/json" }) }
      );
    }
    try {
      const result = await sendEmail({
        template: template.id,
        subject: template.subject,
        to: recipient,
        variables: {
          owner_name: owner?.full_name || owner?.email || "A SafeCircle user",
          member_name: member.name || "Family member",
          relationship: member.relationship || "",
          invite_url: inviteUrl,
          email: recipient,
          user_id: userData.user.id,
          member_id: member.id || invite.member_id,
          invite_id: invite.id
        },
        scenario: "member_invite",
        idempotencyKey
      });
      await markDeliverySent(supabase, delivery.id, result.provider, result.messageId);
      await supabase.from("member_invites").update({ status: "sent" }).eq("id", invite.id);
      await supabase.from("safe_circle_members").update({
        invite_status: "sent",
        invite_sent_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", invite.member_id).eq("user_id", userData.user.id);
      return new Response(
        JSON.stringify({ ok: true, sent: true, delivery_id: delivery.id }),
        { headers: withCors(req, { "Content-Type": "application/json" }) }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markDeliveryFailed(supabase, delivery.id, message);
      await supabase.from("member_invites").update({ status: "failed" }).eq("id", invite.id);
      await supabase.from("safe_circle_members").update({ invite_status: "failed" }).eq("id", invite.member_id).eq("user_id", userData.user.id);
      throw error;
    }
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
