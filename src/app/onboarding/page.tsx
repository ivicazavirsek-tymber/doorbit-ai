import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { loadStripePricingCards } from "@/lib/stripe/pricing-cards";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const { data: onboarding } = await supabase
    .from("user_onboarding")
    .select("main_city, door_styles")
    .eq("user_id", user.id)
    .maybeSingle();

  const cards = await loadStripePricingCards();

  return (
    <div className="min-h-full bg-zinc-950 px-4 py-10 pb-16 text-zinc-100">
      <OnboardingWizard
        email={user.email || ""}
        initialBusinessName={profile?.business_name || ""}
        initialMainCity={onboarding?.main_city || ""}
        initialDoorStyles={onboarding?.door_styles || []}
        cards={cards}
      />
    </div>
  );
}
