import { useCallback, useEffect, useState } from "react"
import { Loader2, Search, ChevronLeft, ChevronRight, HeartHandshake, Plus, X } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const rupee = (n) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_STYLES = {
  collected: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  refunded: "bg-slate-100 text-slate-600",
  unpaid: "bg-slate-100 text-slate-500",
}

const EMPTY = {
  summary: {
    totalCollected: 0,
    collectedOrders: 0,
    collectedToday: 0,
    collectedThisMonth: 0,
    averageDonation: 0,
    pendingAmount: 0,
    pendingOrders: 0,
    refundedAmount: 0,
    refundedOrders: 0,
  },
  daily: [],
  donations: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 1 },
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function Donations() {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const [donationEnabled, setDonationEnabled] = useState(false)
  const [donationAmounts, setDonationAmounts] = useState([])
  const [newAmount, setNewAmount] = useState("")
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false
    adminAPI
      .getFeeSettings()
      .then((res) => {
        const fs = res?.data?.data?.feeSettings
        if (cancelled || !fs) return
        setDonationEnabled(fs.donationEnabled === true)
        const list =
          Array.isArray(fs.donationAmounts) && fs.donationAmounts.length > 0
            ? fs.donationAmounts
            : fs.donationAmount > 0
              ? [fs.donationAmount]
              : []
        setDonationAmounts(list.map(Number).sort((a, b) => a - b))
      })
      .catch(() => toast.error("Failed to load donation settings"))
      .finally(() => !cancelled && setSettingsLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const addAmount = () => {
    const n = Number(newAmount)
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      toast.error("Enter a whole amount between 1 and 1000")
      return
    }
    if (donationAmounts.includes(n)) {
      toast.error(`₹${n} is already added`)
      return
    }
    if (donationAmounts.length >= 10) {
      toast.error("You can add up to 10 amounts")
      return
    }
    setDonationAmounts([...donationAmounts, n].sort((a, b) => a - b))
    setNewAmount("")
  }

  const removeAmount = (n) => setDonationAmounts(donationAmounts.filter((a) => a !== n))

  const saveSettings = async () => {
    if (donationEnabled && donationAmounts.length === 0) {
      toast.error("Add at least one donation amount to enable donations")
      return
    }
    try {
      setSavingSettings(true)
      const res = await adminAPI.createOrUpdateFeeSettings({ donationEnabled, donationAmounts })
      if (res?.data?.success) {
        toast.success("Donation settings saved")
        window.dispatchEvent(new CustomEvent("businessSettingsUpdated"))
      } else {
        toast.error(res?.data?.message || "Failed to save donation settings")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save donation settings")
    } finally {
      setSavingSettings(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status) params.status = status
      if (from) params.from = from
      if (to) params.to = to
      if (search) params.search = search
      const res = await adminAPI.getDonations(params)
      setData({ ...EMPTY, ...(res?.data?.data || {}) })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load donations")
    } finally {
      setLoading(false)
    }
  }, [page, status, from, to, search])

  useEffect(() => {
    void load()
  }, [load])

  const { summary, daily, donations, pagination } = data
  const maxDaily = Math.max(1, ...daily.map((d) => d.amount))

  const onFilterChange = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <HeartHandshake className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Donations</h1>
          <p className="text-sm text-slate-500">Donations customers added at checkout. Collected by the platform.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Donation settings</h2>
        {settingsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={donationEnabled}
                aria-label="Enable donation at checkout"
                onClick={() => setDonationEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  donationEnabled ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    donationEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">
                Enable donation at checkout
                <span className={`ml-2 text-xs font-semibold ${donationEnabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {donationEnabled ? "On" : "Off"}
                </span>
              </span>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Donation amounts (₹)</label>
              <div className="flex flex-wrap items-center gap-2">
                {donationAmounts.length === 0 && (
                  <span className="text-sm text-slate-400">No amounts added yet.</span>
                )}
                {donationAmounts.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium pl-3 pr-1.5 py-1"
                  >
                    ₹{a}
                    <button
                      type="button"
                      onClick={() => removeAmount(a)}
                      className="rounded-full p-0.5 hover:bg-emerald-100"
                      aria-label={`Remove ₹${a}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addAmount()
                    }
                  }}
                  placeholder="e.g. 10"
                  className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addAmount}
                  className="flex items-center gap-1 border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" /> Add amount
                </button>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={savingSettings}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-2"
            >
              {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Customers can pick one of these amounts in the cart (up to 10, whole rupees). The full amount goes to the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total collected"
          value={rupee(summary.totalCollected)}
          hint={`${summary.collectedOrders} delivered orders`}
        />
        <StatCard label="Today" value={rupee(summary.collectedToday)} />
        <StatCard label="This month" value={rupee(summary.collectedThisMonth)} />
        <StatCard label="Average per order" value={rupee(summary.averageDonation)} />
        <StatCard
          label="Pending"
          value={rupee(summary.pendingAmount)}
          hint={`${summary.pendingOrders} orders in progress`}
        />
        <StatCard
          label="Refunded (cancelled)"
          value={rupee(summary.refundedAmount)}
          hint={`${summary.refundedOrders} orders`}
        />
      </div>

      {daily.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Collected per day (recent days with donations)</h2>
          <div className="flex items-end gap-1 h-32">
            {daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 min-w-[6px] h-full flex flex-col justify-end"
                title={`${d.date}: ${rupee(d.amount)} (${d.orders} orders)`}
              >
                <div
                  className="bg-emerald-500 rounded-t"
                  style={{ height: `${Math.max(4, (d.amount / maxDaily) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>{daily[0].date}</span>
            <span>{daily[daily.length - 1].date}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-slate-200">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={onFilterChange(setStatus)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="collected">Collected</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={onFilterChange(setFrom)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={onFilterChange(setTo)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <form
            className="flex items-end gap-2 ml-auto"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(searchInput.trim())
              setPage(1)
            }}
          >
            <div>
              <label className="block text-xs text-slate-500 mb-1">Order ID</label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search order"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="border border-slate-300 rounded-lg p-2.5 hover:bg-slate-50"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3 text-right">Order total</th>
                <th className="px-4 py-3 text-right">Donation</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin inline text-slate-400" />
                  </td>
                </tr>
              ) : donations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No donations found.
                  </td>
                </tr>
              ) : (
                donations.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      #{String(d.orderId).slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(d.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.customerName || "-"}
                      {d.customerPhone ? (
                        <span className="block text-xs text-slate-400">{d.customerPhone}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.restaurantName || "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{rupee(d.orderTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{rupee(d.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          STATUS_STYLES[d.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200 text-sm text-slate-600">
          <span>
            {pagination.total} donation{pagination.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border border-slate-300 rounded-lg p-2 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="border border-slate-300 rounded-lg p-2 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
