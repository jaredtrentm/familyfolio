'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, CheckCircle, AlertCircle, Check, X } from 'lucide-react';

// Password strength requirements (same as register)
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*(),.?":{}|<>]/,
};

function checkPasswordStrength(password: string) {
  return {
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    hasUppercase: PASSWORD_REQUIREMENTS.hasUppercase.test(password),
    hasLowercase: PASSWORD_REQUIREMENTS.hasLowercase.test(password),
    hasNumber: PASSWORD_REQUIREMENTS.hasNumber.test(password),
    hasSpecial: PASSWORD_REQUIREMENTS.hasSpecial.test(password),
  };
}

function isPasswordValid(password: string) {
  const strength = checkPasswordStrength(password);
  return Object.values(strength).every(Boolean);
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid(password) && passwordsMatch && confirmPassword.length > 0;

  // Check if we have valid params
  const hasValidParams = token && email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit || !hasValidParams) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasValidParams) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('invalidResetToken')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href={`/${locale}/forgot-password`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('resetPasswordSuccess')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            You can now log in with your new password.
          </p>
          <Link
            href={`/${locale}/login`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
      <div className="text-center mb-8">
        <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('resetPassword')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('newPassword')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setShowPasswordRequirements(true)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {/* Password strength indicator */}
          {showPasswordRequirements && password.length > 0 && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t('passwordRequirements')}
              </p>
              <div className="space-y-1">
                <RequirementCheck met={passwordStrength.minLength} text={t('req8chars')} />
                <RequirementCheck met={passwordStrength.hasUppercase} text={t('reqUppercase')} />
                <RequirementCheck met={passwordStrength.hasLowercase} text={t('reqLowercase')} />
                <RequirementCheck met={passwordStrength.hasNumber} text={t('reqNumber')} />
                <RequirementCheck met={passwordStrength.hasSpecial} text={t('reqSpecial')} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('confirmPassword')}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              confirmPassword.length > 0 && !passwordsMatch
                ? 'border-red-500 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {t('passwordsDoNotMatch')}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !canSubmit}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? tCommon('loading') : t('resetPassword')}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          href={`/${locale}/login`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToLogin')}
        </Link>
      </p>
    </div>
  );
}

function RequirementCheck({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <X className="w-3.5 h-3.5 text-gray-400" />
      )}
      <span className={met ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
        {text}
      </span>
    </div>
  );
}
