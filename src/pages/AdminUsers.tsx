import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

type AdminRow = {
  user_id: string;
  email: string;
  is_owner: boolean;
  created_at: string;
};

export function AdminUsers() {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id,email,is_owner,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      showToast(error.message, "error");
      setLoading(false);
      return;
    }
    setAdmins(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const callAdminFn = async (body: any) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("No auth token. Please log in again.");

  const { data, error } = await supabase.functions.invoke("create_admin_user", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);

  return data;
};

const resetPassword = async (user_id: string) => {
  const temp = window.prompt("Enter a temporary password (min 8 chars):");
  if (!temp) return;
  await callAdminFn({ action: "reset_password", user_id, temp_password: temp });
  showToast("Password reset. User must change it on next login.", "success");
};

const disableAdmin = async (user_id: string) => {
  await callAdminFn({ action: "disable_admin", user_id });
  showToast("Admin disabled.", "success");
  loadAdmins();
};

const enableAdmin = async (user_id: string) => {
  await callAdminFn({ action: "enable_admin", user_id });
  showToast("Admin enabled.", "success");
  loadAdmins();
};

const removeAdmin = async (user_id: string) => {
  if (!confirm("Remove this co-admin permanently?")) return;
  await callAdminFn({ action: "remove_admin", user_id });
  showToast("Co-admin removed.", "success");
  loadAdmins();
};



  

const addAdmin = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!email || !password) {
    showToast("Email and password are required", "error");
    return;
  }
  const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData?.session?.access_token;

if (!token) {
  showToast("No access token found. Please log in again.", "error");
  return;
}

const { data, error } = await supabase.functions.invoke("create_admin_user", {
  body: { action: "create", email, password },
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

console.log("EDGE data:", data);
console.log("EDGE error:", error);

if (error) {
  showToast(error.message, "error");
  return;
}
if ((data as any)?.error) {
  showToast((data as any).error, "error");
  return;
}

  showToast("Co-admin added successfully", "success");

  setEmail("");
  setPassword("");
  loadAdmins();
};





  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow p-5">
        <h1 className="text-lg font-bold text-gray-900">Admins</h1>
        <p className="text-sm text-gray-600 mt-1">
          Only the <span className="font-semibold">owner admin</span> can add co-admins.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-semibold text-gray-900">Add Co-admin</h2>
        <form onSubmit={addAdmin} className="mt-4 grid gap-3 max-w-xl">
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <button className="bg-green-600 text-white rounded-lg px-4 py-2 hover:bg-green-700">
            Add Admin
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-semibold text-gray-900">Current Admins</h2>

        {loading ? (
          <p className="text-sm text-gray-600 mt-3">Loading...</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-gray-600 mt-3">No admins found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody className="text-gray-900">
                {admins.map((a) => (
                  <tr key={a.user_id} className="border-t">
                    <td className="py-2 pr-4">{a.email}</td>
                    <td className="py-2 pr-4">{a.is_owner ? "Owner" : "Co-admin"}</td>
                    <td className="py-2 pr-4">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
