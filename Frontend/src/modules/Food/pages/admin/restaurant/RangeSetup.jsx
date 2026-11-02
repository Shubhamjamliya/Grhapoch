import { useState, useEffect, useMemo } from "react"
import { MapPin, Search } from "lucide-react"
import { adminAPI } from "@food/api"

export default function RangeSetup() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [editedRadii, setEditedRadii] = useState({})
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    fetchRestaurants()
  }, [])

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getRestaurants({ status: "approved" })
      const list = response?.data?.data?.restaurants || []
      setRestaurants(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error("Error fetching restaurants:", error)
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRestaurants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return restaurants
    return restaurants.filter((r) =>
      (r.restaurantName || r.name || "").toLowerCase().includes(q) ||
      (r.city || r.location?.city || "").toLowerCase().includes(q) ||
      (r.area || r.location?.area || "").toLowerCase().includes(q),
    )
  }, [restaurants, searchQuery])

  const getId = (r) => r._id || r.id

  const handleRadiusChange = (restaurantId, value) => {
    setEditedRadii((prev) => ({ ...prev, [restaurantId]: value }))
  }

  const handleSave = async (restaurant) => {
    const id = getId(restaurant)
    const raw = editedRadii[id]
    const radius = Number(raw)
    if (!Number.isFinite(radius) || radius < 1 || radius > 20) {
      alert("Delivery radius must be between 1 and 20 km")
      return
    }

    try {
      setSavingId(id)
      const response = await adminAPI.updateRestaurant(id, { deliveryRadiusKm: radius })
      const updated = response?.data?.data?.restaurant
      setRestaurants((prev) =>
        prev.map((r) => (getId(r) === id ? { ...r, deliveryRadiusKm: updated?.deliveryRadiusKm ?? radius } : r)),
      )
      setEditedRadii((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (error) {
      console.error("Error saving delivery radius:", error)
      alert(error?.response?.data?.message || "Failed to save delivery radius. Please try again.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Range Setup</h1>
            <p className="text-sm text-slate-600">
              Set each restaurant's delivery radius. Customers can order, and riders get offers, only within this radius.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Search Restaurant</label>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, city or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Delivery Radius (km)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      Loading restaurants...
                    </td>
                  </tr>
                ) : filteredRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                      No restaurants found.
                    </td>
                  </tr>
                ) : (
                  filteredRestaurants.map((r) => {
                    const id = getId(r)
                    const currentValue = editedRadii[id] ?? r.deliveryRadiusKm ?? 5
                    const hasChange = editedRadii[id] !== undefined
                    const city = r.city || r.location?.city || ""
                    const area = r.area || r.location?.area || ""
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 shrink-0">
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={typeof r.profileImage === "string" && r.profileImage ? r.profileImage : (r.profileImage?.url || "https://placehold.co/100x100")}
                                alt={r.restaurantName || r.name}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{r.restaurantName || r.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {[area, city].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={currentValue}
                            onChange={(e) => handleRadiusChange(id, e.target.value)}
                            className="w-24 px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleSave(r)}
                            disabled={!hasChange || savingId === id}
                            className="px-4 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {savingId === id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
