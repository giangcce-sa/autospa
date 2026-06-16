import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  const exists = await hasAnyUser();
  if (exists) redirect("/login");
  return <SetupForm />;
}
