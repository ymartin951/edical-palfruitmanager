import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

export function ChangePassword() {
  const { showToast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // ✅ This determines the behavior after password change
  // true  -> forced change (redirect to dashboard)
  // false -> deliberate change (logout then login)
  const [wasForced, setWasForced] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function loadFlag() {
      setChecking(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          // If user can't be loaded, push to login
          showToast("Session expired. Please login again.", "error");
          window.location.href = "/login";
          return;
        }

        const user = data.user;
        const mustChange = Boolean(user?.user_metadata?.must_change_password);

        if (mounted) setWasForced(mustChange);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    void loadFlag();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirm) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setLoading(true);

    // ✅ Update password, and always turn off the forced flag
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });

    setLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Password updated successfully.", "success");

    // ✅ Behavior rules:
    // - Forced (new admin) -> go to dashboard
    // - Deliberate change -> logout then login again
    if (wasForced) {
      window.location.href = "/dashboard";
      return;
    }

    // Deliberate change: sign out and force fresh login
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-900">Change Password</h1>

        <p className="text-sm text-gray-600 mt-2">
          {wasForced
            ? "You must change your password before continuing."
            : "Change your password. You will be logged out after updating it."}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="text-sm text-gray-700">New Password</label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Confirm Password</label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>

          <button
            className="w-full bg-green-600 text-white rounded-lg py-2 hover:bg-green-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
