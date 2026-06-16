import { Suspense } from "react";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const exists = await hasAnyUser();
  if (!exists) redirect("/setup");
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
