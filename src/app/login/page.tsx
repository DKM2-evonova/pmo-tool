'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Chrome, Building2, Loader2, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientLog } from '@/lib/client-logger';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<'google' | 'microsoft' | 'email' | null>(
    null
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSignIn = async (provider: 'google' | 'azure') => {
    setIsLoading(provider === 'google' ? 'google' : 'microsoft');
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (error) {
      clientLog.error('Sign in error', { error: error instanceof Error ? error.message : 'Unknown error' });
      setIsLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading('email');

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Create profile for new user
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.email?.split('@')[0] || 'User',
              global_role: 'user',
            });

          if (profileError) {
            clientLog.error('Profile creation error', { error: profileError.message });
          }

          // For local development, auto-confirm and sign in
          if (data.user && !data.session) {
            // Try to sign in immediately for local dev
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (signInError) throw signInError;
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">PMO Tool</span>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Transform meetings
            <br />
            into action
          </h1>
          <p className="max-w-md text-lg text-primary-100">
            AI-powered extraction of action items, decisions, and risks from
            your meeting transcripts. Reduce administrative overhead and keep
            your projects on track.
          </p>
          <div className="flex flex-wrap gap-3 pt-4">
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
              Action Items
            </div>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
              Decisions
            </div>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
              Risk Analysis
            </div>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white">
              Meeting Recaps
            </div>
          </div>
        </div>

        <div className="text-sm text-primary-200">
          Powered by Gemini 3 Pro and GPT-5.2
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-surface-900">
                PMO Tool
              </span>
            </div>
            <h2 className="text-2xl font-bold text-surface-900">
              Welcome back
            </h2>
            <p className="mt-2 text-surface-500">
              Sign in with your work account to continue
            </p>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading !== null}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-surface-900 placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-surface-100"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading !== null}
                  minLength={6}
                  className="w-full rounded-lg border border-surface-300 px-4 py-2 text-surface-900 placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-surface-100"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading !== null}
              className="btn w-full bg-primary-600 text-white py-3 hover:bg-primary-700 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading === 'email' ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              disabled={isLoading !== null}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-surface-500">Or continue with</span>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleSignIn('google')}
              disabled={isLoading !== null}
              className="btn flex w-full items-center justify-center gap-3 border border-surface-300 bg-white py-3 text-surface-700 hover:bg-surface-50 focus:ring-surface-400 disabled:opacity-50"
            >
              {isLoading === 'google' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="h-5 w-5" />
              )}
              <span>Continue with Google</span>
            </button>

            <button
              onClick={() => handleSignIn('azure')}
              disabled={isLoading !== null}
              className="btn flex w-full items-center justify-center gap-3 border border-surface-300 bg-white py-3 text-surface-700 hover:bg-surface-50 focus:ring-surface-400 disabled:opacity-50"
            >
              {isLoading === 'microsoft' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
              <span>Continue with Microsoft</span>
            </button>
          </div>

          <p className="text-center text-sm text-surface-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

