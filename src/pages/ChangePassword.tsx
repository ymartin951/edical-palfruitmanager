import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

export function ChangePassword() {
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

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

    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false }, // ✅ turn off the flag
    });

    setLoading(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Password updated successfully.", "success");
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
        <p className="text-sm text-gray-600 mt-2">
          You must change your password before accessing the dashboard.
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
