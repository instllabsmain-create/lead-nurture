import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-parchment px-6 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
          INSTL.LABS
        </p>
        <h1 className="mb-2 font-display text-4xl font-black uppercase text-pitch">
          Sign In.
        </h1>
        <p className="mb-8 font-body text-sm text-dust">
          Use Clerk to access the dashboard.
        </p>

        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
