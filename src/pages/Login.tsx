import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-brand-gold/50">
          <div className="bg-white px-6 sm:px-8 py-8 sm:py-10 text-center border-b-4 border-brand-gold">
            <div className="flex justify-center mb-4">
              <Logo size="large" variant="full" />
            </div>
            <p className="text-brand-secondary text-sm sm:text-base font-semibold">
              Advance Tracking • Fruit Collection • Reconciliation
            </p>
          </div>

          <div className="px-6 sm:px-8 py-6 sm:py-8 bg-brand-bg/30">
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-brand-text mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-brand-muted/30 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition text-base bg-white text-brand-text"
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-brand-text mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-brand-muted/30 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition text-base bg-white text-brand-text"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="bg-brand-red/10 border-2 border-brand-red/30 text-brand-red px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary text-white py-3 sm:py-4 rounded-lg font-semibold text-base hover:bg-brand-primary-dark transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] border-2 border-brand-primary-dark"
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p className="font-medium">No public sign-up.</p>
              <p className="mt-1">
                If you need access, ask the system owner to add you as a co-admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
