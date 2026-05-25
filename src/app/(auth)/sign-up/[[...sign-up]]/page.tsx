import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-parchment px-6 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
          INSTL.LABS
        </p>
        <h1 className="mb-2 font-display text-4xl font-black uppercase text-pitch">
          Create Account.
        </h1>
        <p className="mb-8 font-body text-sm text-dust">
          Create your Clerk account to access the dashboard.
        </p>

        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/login"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
