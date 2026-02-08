import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, X } from "lucide-react";
import { supabaseUntyped as supabase } from "../lib/supabase";
import { useToast } from "../contexts/ToastContext";

type AgentStatus = "ACTIVE" | "INACTIVE";

/**
 * IMPORTANT:
 * We define these types locally to avoid "never" issues when database.types
 * is out of sync (e.g., missing the agents table).
 */
type AgentDbRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  status: AgentStatus | string;
  photo_url: string | null;
};

type AgentInsert = {
  full_name: string;
  phone: string | null;
  location: string | null;
  status: AgentStatus;
  photo_url: string | null;
};

type AgentUpdate = Partial<AgentInsert>;

interface AgentFormData {
  full_name: string;
  phone: string;
  location: string;
  status: AgentStatus;
  /**
   * For private bucket, store storage PATH (e.g. "agents/uuid.png")
   */
  photo_url: string;
}

const BUCKET = "agent-photos";

function makeFileName(originalName: string) {
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${uuid}.${ext}`;
}

export function AgentForm() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isEdit = !!agentId;

  const [loading, setLoading] = useState<boolean>(!!agentId);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [formData, setFormData] = useState<AgentFormData>({
    full_name: "",
    phone: "",
    location: "",
    status: "ACTIVE",
    photo_url: "",
  });

  const [originalPhotoPath, setOriginalPhotoPath] = useState<string>("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const canSubmit = useMemo(() => !submitting && !uploadingPhoto, [submitting, uploadingPhoto]);

  useEffect(() => {
    if (!agentId) return;
    void loadAgent(agentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadAgent = async (id: string) => {
    setLoading(true);
    try {
      // Cast returns to avoid "never" from mismatched DB types
      const { data, error } = await supabase
        .from("agents")
        .select("id, full_name, phone, location, status, photo_url")
        .eq("id", id)
        .maybeSingle()
        .returns<AgentDbRow>();

      if (error) {
        showToast(error.message, "error");
        navigate("/agents");
        return;
      }

      if (!data) {
        showToast("Agent not found", "error");
        navigate("/agents");
        return;
      }

      setFormData({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        location: data.location ?? "",
        status: (data.status as AgentStatus) ?? "ACTIVE",
        photo_url: data.photo_url ?? "",
      });

      setOriginalPhotoPath(data.photo_url ?? "");

      if (data.photo_url) {
        const { data: signed, error: signedErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(data.photo_url, 60 * 60);

        if (!signedErr && signed?.signedUrl) setPhotoPreview(signed.signedUrl);
        else setPhotoPreview("");
      } else {
        setPhotoPreview("");
      }
    } catch (err: any) {
      showToast(err?.message || "Error loading agent", "error");
      navigate("/agents");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("Photo size must be less than 5MB", "error");
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showToast("Photo must be JPG, PNG, or WebP", "error");
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview("");
    setFormData((prev) => ({ ...prev, photo_url: "" }));
  };

  const uploadPhotoIfNeeded = async (): Promise<string | null> => {
    if (!photoFile) return formData.photo_url || null;

    setUploadingPhoto(true);
    try {
      const fileName = makeFileName(photoFile.name);
      const filePath = `agents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, photoFile, { upsert: false, cacheControl: "3600" });

      if (uploadError) {
        showToast(uploadError.message, "error");
        return null;
      }

      return filePath;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhotoIfExists = async (path: string) => {
    if (!path) return;
    await supabase.storage.from(BUCKET).remove([path]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name.trim()) {
      showToast("Full name is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Upload photo (if a new file is chosen)
      const finalPhotoPath = await uploadPhotoIfNeeded();
      if (photoFile && !finalPhotoPath) {
        setSubmitting(false);
        return;
      }

      const photoToSave = finalPhotoPath ?? "";
      const payloadBase: AgentInsert = {
        full_name: formData.full_name.trim(),
        phone: formData.phone ? formData.phone : null,
        location: formData.location ? formData.location : null,
        status: formData.status,
        photo_url: photoToSave ? photoToSave : null,
      };

      if (isEdit && agentId) {
        const updatePayload: AgentUpdate = payloadBase;

        // ✅ Fix: cast payload to avoid "never" overload from mismatched generated types
        const { error } = await supabase.from("agents").update(updatePayload as any).eq("id", agentId);

        if (error) {
          showToast(error.message, "error");
          return;
        }

        if (photoFile && originalPhotoPath && originalPhotoPath !== photoToSave) {
          await deletePhotoIfExists(originalPhotoPath);
        }

        showToast("Agent updated successfully", "success");
      } else {
        // ✅ Fix: cast payload to avoid "never" overload from mismatched generated types
        const { error } = await supabase.from("agents").insert(payloadBase as any);

        if (error) {
          showToast(error.message, "error");
          return;
        }

        showToast("Agent added successfully", "success");
      }

      navigate("/agents");
    } catch (err: any) {
      showToast(err?.message || "Error saving agent", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate("/agents");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Agents
      </button>

      <div className="bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEdit ? "Edit Agent" : "Add New Agent"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              placeholder="e.g., Accra Region"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as AgentStatus }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Agent Photo</label>

            <div className="space-y-3">
              {photoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Agent preview"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">Upload an agent photo (optional)</p>
                  <label className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700">
                    Choose File
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>
              )}

              {!photoPreview && (
                <p className="text-xs text-gray-500">Supported formats: JPG, PNG, WebP. Max 5MB.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={!canSubmit}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
              disabled={!canSubmit}
            >
              {submitting || uploadingPhoto ? "Saving..." : isEdit ? "Update Agent" : "Add Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
