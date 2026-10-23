import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Smartphone,
  ExternalLink,
  Search,
  Eye,
  EyeOff
} from "lucide-react";
import api from "@food/api";
import { getModuleToken } from "@food/utils/auth";
import { Input } from "@food/components/ui/input";
import { Label } from "@food/components/ui/label";
import { Button } from "@food/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog";

export default function OtherAppsManagement() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    playStoreLink: "",
    appStoreLink: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  const getAuthConfig = (additionalConfig = {}) => {
    const adminToken = getModuleToken("admin");
    if (!adminToken || adminToken.trim() === "" || adminToken === "null") {
      return additionalConfig;
    }
    return {
      ...additionalConfig,
      headers: {
        ...additionalConfig.headers,
        Authorization: `Bearer ${adminToken.trim()}`,
      },
    };
  };

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/food/other-apps", getAuthConfig());
      if (res.data.success) {
        setApps(res.data.data.items || []);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 404) {
        setError(err.response?.data?.message || "Failed to fetch apps list");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      subtitle: "",
      playStoreLink: "",
      appStoreLink: "",
    });
    setSelectedFile(null);
    if (previewUrl && !selectedApp) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedApp(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, SVG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (app) => {
    resetForm();
    setSelectedApp(app);
    setFormData({
      title: app.title || "",
      subtitle: app.subtitle || "",
      playStoreLink: app.playStoreLink || "",
      appStoreLink: app.appStoreLink || "",
    });
    setPreviewUrl(app.iconUrl || app.imageUrl || null);
    setIsEditModalOpen(true);
  };

  // Create App Submit
  const handleCreateApp = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("App title is required");
      return;
    }
    if (!selectedFile) {
      setError("Please select an app icon image");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const body = new FormData();
      body.append("image", selectedFile);
      body.append("title", formData.title.trim());
      body.append("subtitle", formData.subtitle.trim());
      body.append("playStoreLink", formData.playStoreLink.trim());
      body.append("appStoreLink", formData.appStoreLink.trim());

      const res = await api.post(
        "/food/other-apps",
        body,
        getAuthConfig({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );

      if (res.data.success) {
        setSuccess("App added successfully!");
        setIsAddModalOpen(false);
        resetForm();
        await fetchApps();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add app");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update App Submit
  const handleUpdateApp = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!formData.title.trim()) {
      setError("App title is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      const body = new FormData();
      if (selectedFile) {
        body.append("image", selectedFile);
      }
      body.append("title", formData.title.trim());
      body.append("subtitle", formData.subtitle.trim());
      body.append("playStoreLink", formData.playStoreLink.trim());
      body.append("appStoreLink", formData.appStoreLink.trim());

      const res = await api.patch(
        `/food/other-apps/${selectedApp._id}`,
        body,
        getAuthConfig({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );

      if (res.data.success) {
        setSuccess("App details updated successfully!");
        setIsEditModalOpen(false);
        resetForm();
        await fetchApps();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update app details");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete App
  const handleDeleteApp = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      setDeletingId(id);
      setError(null);
      setSuccess(null);
      const res = await api.delete(`/food/other-apps/${id}`, getAuthConfig());
      if (res.data.success) {
        setSuccess("App deleted successfully!");
        await fetchApps();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete app");
    } finally {
      setDeletingId(null);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      setError(null);
      setSuccess(null);
      const res = await api.patch(`/food/other-apps/${id}/status`, {}, getAuthConfig());
      if (res.data.success) {
        setSuccess(`App ${currentStatus ? "deactivated" : "activated"} successfully!`);
        await fetchApps();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update app status");
    }
  };

  // Change Order
  const handleOrderChange = async (id, direction) => {
    const item = apps.find((a) => a._id === id);
    if (!item) return;
    const newOrder = direction === "up" ? item.order - 1 : item.order + 1;
    const otherItem = apps.find((a) => a.order === newOrder && a._id !== id);
    if (!otherItem && newOrder < 0) return;

    try {
      setError(null);
      await api.patch(`/food/other-apps/${id}/order`, { order: newOrder }, getAuthConfig());
      if (otherItem) {
        await api.patch(
          `/food/other-apps/${otherItem._id}/order`,
          { order: item.order },
          getAuthConfig()
        );
      }
      await fetchApps();
    } catch (err) {
      setError("Failed to update app order");
    }
  };

  const filteredApps = apps.filter((app) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.title?.toLowerCase().includes(q) ||
      app.subtitle?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Other Apps Management
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Add and manage external Play Store & App Store links shown on the user app home screen.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Add New App
        </Button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* Toolbar & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by title or subtitle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
          />
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Total Apps: <span className="font-bold text-gray-900 dark:text-gray-100">{apps.length}</span>
        </div>
      </div>

      {/* Apps Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          <span className="ml-3 text-sm text-gray-500 font-medium">Loading apps...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">No Apps Found</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            {searchQuery ? "No apps match your search filter." : "Click below to add your first app link card."}
          </p>
          {!searchQuery && (
            <Button onClick={handleOpenAddModal} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Add App
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app, idx) => (
            <div
              key={app._id}
              className={`bg-white dark:bg-gray-800 rounded-2xl border ${
                app.isActive !== false
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-gray-200 dark:border-gray-800 opacity-60"
              } p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between`}
            >
              <div className="space-y-4">
                {/* Top header: Icon & Order & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-2 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={app.iconUrl || app.imageUrl}
                        alt={app.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">
                        {app.title}
                      </h3>
                      {app.subtitle && (
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                          {app.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOrderChange(app._id, "up")}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOrderChange(app._id, "down")}
                      disabled={idx === filteredApps.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Link Status Badges */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Play Store:
                    </span>
                    {app.playStoreLink ? (
                      <a
                        href={app.playStoreLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-600 font-medium hover:underline max-w-[180px] truncate flex items-center gap-1"
                      >
                        Link set <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      App Store:
                    </span>
                    {app.appStoreLink ? (
                      <a
                        href={app.appStoreLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-600 font-medium hover:underline max-w-[180px] truncate flex items-center gap-1"
                      >
                        Link set <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleToggleStatus(app._id, app.isActive !== false)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${
                    app.isActive !== false
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {app.isActive !== false ? (
                    <>
                      <Eye className="w-3 h-3" /> Active
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" /> Inactive
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditModal(app)}
                    className="h-8 px-2.5 text-xs border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1 text-gray-600 dark:text-gray-300" />
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletingId === app._id}
                    onClick={() => handleDeleteApp(app._id, app.title)}
                    className="h-8 px-2.5 text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-900/60 border-none shadow-none"
                  >
                    {deletingId === app._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= ADD APP MODAL ================= */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Add New External App
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Upload an app icon logo and configure Play Store / App Store redirection links.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateApp} className="space-y-4 mt-3">
            {/* App Icon Upload */}
            <div>
              <Label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                App Icon Logo <span className="text-red-500">*</span>
              </Label>

              <div className="mt-1.5 flex items-center gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-rose-500 dark:hover:border-rose-400 bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden group relative"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                      <span className="text-[10px] text-gray-500 mt-1">Upload</span>
                    </>
                  )}
                </div>

                <div className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs rounded-xl"
                  >
                    Choose Image
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Recommended: Square PNG/SVG icon with transparent background (Max 5MB).
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                App Title / Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g. TruBuy, Farmlyf, MediPlus"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 rounded-xl"
                required
              />
            </div>

            {/* Subtitle */}
            <div>
              <Label htmlFor="subtitle" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Subtitle / Category Tagline
              </Label>
              <Input
                id="subtitle"
                placeholder="e.g. Grocery, Fresh Food, Hotels"
                value={formData.subtitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Play Store Link */}
            <div>
              <Label htmlFor="playStore" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Google Play Store Link
              </Label>
              <Input
                id="playStore"
                type="url"
                placeholder="https://play.google.com/store/apps/details?id=..."
                value={formData.playStoreLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, playStoreLink: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* App Store Link */}
            <div>
              <Label htmlFor="appStore" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Apple App Store Link
              </Label>
              <Input
                id="appStore"
                type="url"
                placeholder="https://apps.apple.com/app/..."
                value={formData.appStoreLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, appStoreLink: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding App...
                  </>
                ) : (
                  "Add App"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= EDIT APP MODAL ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Edit App Details
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Update heading, icon logo, or store links for "{selectedApp?.title}".
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateApp} className="space-y-4 mt-3">
            {/* Icon Preview & Change */}
            <div>
              <Label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                App Icon Logo
              </Label>

              <div className="mt-1.5 flex items-center gap-4">
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-rose-500 bg-gray-50 dark:bg-gray-900 overflow-hidden relative group"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <Upload className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editFileInputRef.current?.click()}
                    className="text-xs rounded-xl"
                  >
                    Change Image
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Leave unchanged to keep current logo icon.
                  </p>
                </div>
              </div>

              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="edit-title" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                App Title / Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-title"
                placeholder="e.g. TruBuy"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 rounded-xl"
                required
              />
            </div>

            {/* Subtitle */}
            <div>
              <Label htmlFor="edit-subtitle" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Subtitle / Category Tagline
              </Label>
              <Input
                id="edit-subtitle"
                placeholder="e.g. Grocery"
                value={formData.subtitle}
                onChange={(e) => setFormData((prev) => ({ ...prev, subtitle: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Play Store Link */}
            <div>
              <Label htmlFor="edit-playStore" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Google Play Store Link
              </Label>
              <Input
                id="edit-playStore"
                type="url"
                placeholder="https://play.google.com/store/apps/details?id=..."
                value={formData.playStoreLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, playStoreLink: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* App Store Link */}
            <div>
              <Label htmlFor="edit-appStore" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Apple App Store Link
              </Label>
              <Input
                id="edit-appStore"
                type="url"
                placeholder="https://apps.apple.com/app/..."
                value={formData.appStoreLink}
                onChange={(e) => setFormData((prev) => ({ ...prev, appStoreLink: e.target.value }))}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
