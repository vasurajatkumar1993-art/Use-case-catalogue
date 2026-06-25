import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CatalogApp from "./CatalogApp";
import type { UseCase } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("use_cases")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  return <CatalogApp initialEntries={(data as UseCase[]) ?? []} email={user.email ?? ""} />;
}
