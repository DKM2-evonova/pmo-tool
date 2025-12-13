'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Chrome, Building2, Loader2, Briefcase } from 'lucide-react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<'google' | 'microsoft' | null>(
    null
  );
  const supabase = createClient();

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
      console.error('Sign in error:', error);
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
          Powered by Gemini and GPT-4o
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

          <div className="space-y-4">
            <button
              onClick={() => handleSignIn('google')}
              disabled={isLoading !== null}
              className="btn flex w-full items-center justify-center gap-3 border border-surface-300 bg-white py-3 text-surface-700 hover:bg-surface-50 focus:ring-surface-400"
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
              className="btn flex w-full items-center justify-center gap-3 border border-surface-300 bg-white py-3 text-surface-700 hover:bg-surface-50 focus:ring-surface-400"
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

