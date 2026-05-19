'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function parseHashError(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const code = params.get('error_code')
  const description = params.get('error_description')
  if (!code) return null
  if (code === 'otp_expired') return 'That login link has expired. Sign in with your email and password below.'
  return description ?? 'Something went wrong. Please sign in again.'
}

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'
  const queryError = searchParams.get('error')

  const [hashError, setHashError] = useState<string | null>(null)

  useEffect(() => {
    const msg = parseHashError()
    if (msg) {
      setHashError(msg)
      // Clean the hash so it doesn't persist on refresh
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const errorMessage =
    hashError ??
    (queryError === 'invalid' ? 'Invalid email or password.' : null)

  return (
    <div className="min-h-[100dvh] bg-parchment flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust mb-4">
          INSTL.LABS
        </p>
        <h1 className="font-display font-black text-4xl uppercase text-pitch mb-2">
          SIGN IN.
        </h1>
        <p className="font-body text-sm text-dust mb-8">
          Enter your credentials to continue.
        </p>

        <form action="/auth/login" method="POST" className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label
              htmlFor="email"
              className="block font-mono text-[9px] uppercase tracking-[2.5px] text-dust mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3.5 py-2.5 font-body text-sm text-pitch bg-white border border-border rounded-md outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron placeholder:text-dust transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-mono text-[9px] uppercase tracking-[2.5px] text-dust mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3.5 py-2.5 font-body text-sm text-pitch bg-white border border-border rounded-md outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron placeholder:text-dust transition-all"
              placeholder="••••••••••••••••"
            />
            {errorMessage && (
              <p className="font-mono text-xs text-red-500 mt-1">
                {errorMessage}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-saffron text-white rounded-md font-body text-sm font-medium hover:bg-saffron-hover active:scale-[0.98] transition-all duration-150"
          >
            Enter dashboard →
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
