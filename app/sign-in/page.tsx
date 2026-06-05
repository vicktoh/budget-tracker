import { Suspense } from "react";
import { SignInRoute } from "@/routes/sign-in";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInRoute />
    </Suspense>
  );
}
