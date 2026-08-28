"use server";

import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function createCreditCheckoutSession(
  packageId: string,
  studentId: string
): Promise<string> {
  const { user, supabase } = await requireUser();

  const { data: pkg } = await supabase
    .from("credit_packages")
    .select("id, name, credit_count, price_usd")
    .eq("id", packageId)
    .eq("active", true)
    .single();
  if (!pkg) throw new Error("존재하지 않는 수업권 패키지입니다.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3010";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${pkg.name} (${pkg.credit_count}장)` },
          unit_amount: Math.round(Number(pkg.price_usd) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      student_id: studentId,
      package_id: pkg.id,
      parent_id: user.id,
    },
    success_url: `${siteUrl}/parent?tab=credits&purchase=success`,
    cancel_url: `${siteUrl}/parent?tab=credits&purchase=cancelled`,
  });
  if (!session.url) throw new Error("결제 세션 생성에 실패했습니다.");

  return session.url;
}
