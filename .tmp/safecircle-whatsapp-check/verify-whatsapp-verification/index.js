// supabase/functions/verify-whatsapp-verification/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { createServiceRoleClient } from "../_shared/notificationDeliveries.ts";
import { sendTransactionalWhatsApp } from "../_shared/sendTransactionalWhatsApp.ts";
import { verifyChallengeOtp } from "../_shared/verificationChallenges.ts";
async function sendWhatsAppWithoutBlocking(serviceClient, input) {
  try {
    return await sendTransactionalWhatsApp(serviceClient, input);
  } catch (error) {
    console.error("Member acceptance WhatsApp delivery failed.", error);
    return "failed";
  }
}
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    if (req.method !== "POST") throw new Error("Method not allowed.");
    const body = await req.json();
    const challengeId = String(body.challengeId || "");
    const code = String(body.code || "");
    if (!challengeId || !/^\d{6}$/.test(code)) {
      throw new Error("A valid challenge and six-digit code are required.");
    }
    const serviceClient = createServiceRoleClient();
    const { data: challenge, error: challengeError } = await serviceClient.from("whatsapp_verification_challenges").select("*").eq("id", challengeId).maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge) throw new Error("Verification challenge not found.");
    if (challenge.subject_type === "profile_phone") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Authentication required.");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_ANON_KEY"),
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user || userData.user.id !== challenge.owner_user_id) {
        throw new Error("Authentication required.");
      }
      const verifiedAt = await verifyChallengeOtp(
        serviceClient,
        challenge,
        code
      );
      const { data: finalized, error: profileError } = await serviceClient.rpc(
        "finalize_profile_phone_verification",
        {
          p_challenge_id: challenge.id,
          p_verified_at: verifiedAt
        }
      );
      if (profileError) throw profileError;
      if (!finalized) throw new Error("This verification code was already used.");
    } else if (challenge.subject_type === "member_phone") {
      const inviteToken = String(body.inviteToken || "");
      if (!inviteToken || body.acceptRole !== true) {
        throw new Error("Explicit invitation acceptance is required.");
      }
      const { data: invite, error: inviteError } = await serviceClient.from("member_invites").select("id,member_id,status").eq("id", challenge.invite_id).eq("invite_token", inviteToken).in("status", ["created", "sent"]).maybeSingle();
      if (inviteError) throw inviteError;
      if (!invite || invite.member_id !== challenge.member_id) {
        throw new Error("This invitation is invalid or no longer active.");
      }
      const verifiedAt = await verifyChallengeOtp(
        serviceClient,
        challenge,
        code
      );
      const { data: finalized, error: memberError } = await serviceClient.rpc(
        "finalize_member_phone_verification",
        {
          p_challenge_id: challenge.id,
          p_invite_token: inviteToken,
          p_verified_at: verifiedAt
        }
      );
      if (memberError) throw memberError;
      if (!finalized) throw new Error("This verification code was already used.");
      try {
        const { data: acceptedInvite, error: acceptedInviteError } = await serviceClient.from("member_invites").select(
          "id,user_id,member_id,accepted_at,safe_circle_members(id,name,phone,phone_normalized,phone_verified_at,whatsapp_opt_in,whatsapp_locale)"
        ).eq("id", invite.id).single();
        if (acceptedInviteError) throw acceptedInviteError;
        const { data: owner, error: ownerError } = await serviceClient.from("profiles").select(
          "id,full_name,phone,phone_normalized,phone_verified_at,whatsapp_opt_in,whatsapp_locale,whatsapp_preferences"
        ).eq("id", acceptedInvite.user_id).maybeSingle();
        if (ownerError) throw ownerError;
        const member = acceptedInvite.safe_circle_members || {};
        const acceptedAt = acceptedInvite.accepted_at || verifiedAt;
        const bodyValues = [
          member.name || "Trusted member",
          owner?.full_name || "SafeCircle account owner",
          acceptedAt
        ];
        await sendWhatsAppWithoutBlocking(serviceClient, {
          userId: acceptedInvite.user_id,
          recipientType: "member",
          recipientId: member.id || acceptedInvite.member_id,
          recipient: member,
          category: "security",
          scenario: "whatsapp_member_invite_accepted",
          relatedEntityType: "member_invite",
          relatedEntityId: acceptedInvite.id,
          idempotencyKey: `whatsapp_member_invite_accepted:${acceptedInvite.id}:member`,
          bodyValues,
          metadata: {
            member_id: member.id || acceptedInvite.member_id,
            accepted_at: acceptedAt
          },
          requireCategoryPreference: false
        });
        if (owner) {
          await sendWhatsAppWithoutBlocking(serviceClient, {
            userId: acceptedInvite.user_id,
            recipientType: "owner",
            recipientId: owner.id,
            recipient: owner,
            category: "security",
            scenario: "whatsapp_member_invite_accepted",
            relatedEntityType: "member_invite",
            relatedEntityId: acceptedInvite.id,
            idempotencyKey: `whatsapp_member_invite_accepted:${acceptedInvite.id}:owner`,
            bodyValues,
            metadata: {
              member_id: member.id || acceptedInvite.member_id,
              accepted_at: acceptedAt
            }
          });
        }
      } catch (error) {
        console.error("Unable to prepare member acceptance confirmations.", error);
      }
    } else {
      throw new Error("Unsupported verification subject.");
    }
    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
