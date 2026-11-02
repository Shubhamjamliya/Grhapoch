import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { MapPin, Search, Save, Loader2, ArrowLeft, Navigation } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { loadGoogleMaps as loadGoogleMapsScript } from "@food/utils/googleMapsLoader"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const parseCoordinate = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getSavedLocationCoords = (location) => {
  if (!location) return null

  let lat = null
  let lng = null

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = parseCoordinate(location.coordinates[0])
    lat = parseCoordinate(location.coordinates[1])
  }

  if (lat === null || lng === null) {
    lat = parseCoordinate(location.latitude)
    lng = parseCoordinate(location.longitude)
  }

  if (lat === null || lng === null) return null

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const swappedLat = lng
    const swappedLng = lat

    if (
      swappedLat >= -90 && swappedLat <= 90 &&
      swappedLng >= -180 && swappedLng <= 180
    ) {
      return { lat: swappedLat, lng: swappedLng }
    }

    return null
  }

  return { lat, lng }
}

export default function ZoneSetup() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const autocompleteInputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const geocoderRef = useRef(null)
  
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState("")
  const [saving, setSaving] = useState(false)
  const [fetchingLocation, setFetchingLocation] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [locationSearch, setLocationSearch] = useState("")
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedAddress, setSelectedAddress] = useState("")
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(5)
  const radiusCircleRef = useRef(null)

  useEffect(() => {
    fetchRestaurantData()
    bootstrapZoneMap()
  }, [])

  const waitForMapContainer = () =>
    new Promise((resolve, reject) => {
      let attempts = 0
      const tick = () => {
        if (mapRef.current) {
          resolve(mapRef.current)
          return
        }
        attempts += 1
        if (attempts >= 50) {
          reject(new Error("Map container not ready. Please refresh the page."))
          return
        }
        setTimeout(tick, 100)
      }
      tick()
    })

  const bootstrapZoneMap = async () => {
    try {
      setMapLoading(true)
      setMapError("")
      await waitForMapContainer()

      const google = window.google?.maps
        ? window.google
        : await loadGoogleMapsScript({ libraries: ["places", "geometry"] })

      initializeMap(google)
    } catch (error) {
      debugError("Error loading Google Maps:", error)
      setMapLoading(false)
      const message =
        error?.message?.includes("API key")
          ? "Google Maps API key is not configured. Please contact your administrator."
          : error?.message || "Failed to load Google Maps. Please refresh and try again."
      setMapError(message)
    }
  }

  // Initialize Places Autocomplete when map is loaded
  useEffect(() => {
    if (!mapLoading && mapInstanceRef.current && autocompleteInputRef.current && window.google?.maps?.places && !autocompleteRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(autocompleteInputRef.current, {
        componentRestrictions: { country: 'in' } // Restrict to India
      })
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.geometry && place.geometry.location && mapInstanceRef.current) {
          const location = place.geometry.location
          const lat = location.lat()
          const lng = location.lng()
          
          // Center map on selected location
          mapInstanceRef.current.setCenter(location)
          mapInstanceRef.current.setZoom(17) // Zoom in when location is selected
          
          // Set the search input value
          const address = place.formatted_address || place.name || ""
          setLocationSearch(address)
          setSelectedAddress(address)
          
          // Update marker position
          updateMarker(lat, lng, address)
          
          // Set selected location
          setSelectedLocation({ lat, lng, address })
          drawRadiusCircle(lat, lng)
        }
      })

      autocompleteRef.current = autocomplete
    }
  }, [mapLoading])

  // Load existing restaurant location when data is fetched
  useEffect(() => {
    if (restaurantData?.location && mapInstanceRef.current && !mapLoading && window.google) {
      const location = restaurantData.location
      const savedCoords = getSavedLocationCoords(location)

      if (Number.isFinite(Number(restaurantData.deliveryRadiusKm))) {
        setDeliveryRadiusKm(Number(restaurantData.deliveryRadiusKm))
      }

      if (savedCoords) {
        const { lat, lng } = savedCoords
        const locationObj = new window.google.maps.LatLng(lat, lng)
        mapInstanceRef.current.setCenter(locationObj)
        mapInstanceRef.current.setZoom(17)
        
        const existingAddress = location.formattedAddress || location.address || formatAddress(location) || ""
        const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(existingAddress.trim())
        
        if ((!existingAddress || isCoordinates) && geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const address = results[0].formatted_address
              setLocationSearch(address)
              setSelectedAddress(address)
              setSelectedLocation({ lat, lng, address })
              updateMarker(lat, lng, address)
              drawRadiusCircle(lat, lng)
            } else {
              setLocationSearch(existingAddress)
              setSelectedAddress(existingAddress)
              setSelectedLocation({ lat, lng, address: existingAddress })
              updateMarker(lat, lng, existingAddress)
              drawRadiusCircle(lat, lng)
            }
          })
        } else {
          setLocationSearch(existingAddress)
          setSelectedAddress(existingAddress)
          setSelectedLocation({ lat, lng, address: existingAddress })
          updateMarker(lat, lng, existingAddress)
          drawRadiusCircle(lat, lng)
        }
      }
    }
  }, [restaurantData, mapLoading])

  // Draw/update the delivery-radius circle on the map around the selected location.
  const drawRadiusCircle = (lat, lng, radiusKm = deliveryRadiusKm) => {
    if (!window.google || !mapInstanceRef.current) return

    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null)
      radiusCircleRef.current = null
    }

    radiusCircleRef.current = new window.google.maps.Circle({
      strokeColor: "#ef4444",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: "#ef4444",
      fillOpacity: 0.12,
      map: mapInstanceRef.current,
      center: { lat, lng },
      radius: Math.max(1, Number(radiusKm) || 0) * 1000,
    })
  }

  // Redraw the circle whenever the radius input changes, keeping it centered on the current location.
  useEffect(() => {
    if (selectedLocation) {
      drawRadiusCircle(selectedLocation.lat, selectedLocation.lng, deliveryRadiusKm)
    }
  }, [deliveryRadiusKm])

  const fetchRestaurantData = async () => {
    try {
      const response = await restaurantAPI.getCurrentRestaurant()
      const data = response?.data?.data?.restaurant || response?.data?.restaurant
      if (data) {
        setRestaurantData(data)
      }
    } catch (error) {
      debugError("Error fetching restaurant data:", error)
    }
  }

  const initializeMap = (google) => {
    try {
      if (!mapRef.current) {
        debugError("? mapRef.current is null in initializeMap")
        setMapLoading(false)
        return
      }

      debugLog("?? Initializing map...")
      // Initial location (India center)
      const initialLocation = { lat: 20.5937, lng: 78.9629 }

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: initialLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE]
        },
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        disableDoubleClickZoom: false,
      })

      mapInstanceRef.current = map
      geocoderRef.current = new google.maps.Geocoder()
      debugLog("? Map and Geocoder initialized successfully")

      // Add click listener to place marker
      map.addListener('click', (event) => {
        const lat = event.latLng.lat()
        const lng = event.latLng.lng()
        
        // Use Geocoder to get address
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const address = results[0].formatted_address
              setLocationSearch(address)
              setSelectedAddress(address)
              setSelectedLocation({ lat, lng, address })
              updateMarker(lat, lng, address)
              drawRadiusCircle(lat, lng)
            } else {
              // Fallback to coordinates if geocoding fails
              const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
              setLocationSearch(address)
              setSelectedAddress(address)
              setSelectedLocation({ lat, lng, address })
              updateMarker(lat, lng, address)
              drawRadiusCircle(lat, lng)
            }
          })
        } else {
          const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          setLocationSearch(address)
          setSelectedAddress(address)
          setSelectedLocation({ lat, lng, address })
          updateMarker(lat, lng, address)
          drawRadiusCircle(lat, lng)
        }
      })

      setMapLoading(false)
      setMapError("")
      debugLog("? Map loading complete")
    } catch (error) {
      debugError("? Error in initializeMap:", error)
      setMapLoading(false)
      setMapError("Failed to initialize map. Please refresh the page.")
    }
  }

  const updateMarker = (lat, lng, address) => {
    if (!mapInstanceRef.current || !window.google) return

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null)
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: address || "Restaurant Location"
    })

    // Add info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 8px; max-width: 250px;">
          <strong>Restaurant Location</strong><br/>
          <small>${address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</small>
        </div>
      `
    })

    marker.addListener('click', () => {
      infoWindow.open(mapInstanceRef.current, marker)
    })

    // Update location when marker is dragged
    marker.addListener('dragend', (event) => {
      const newLat = event.latLng.lat()
      const newLng = event.latLng.lng()
      
      // Use Geocoder to get address
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
          if (status === "OK" && results[0]) {
            const newAddress = results[0].formatted_address
            setLocationSearch(newAddress)
            setSelectedAddress(newAddress)
            setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
            
            // Update info window content if open
            if (infoWindow) {
              infoWindow.setContent(`
                <div style="padding: 8px; max-width: 250px;">
                  <strong>Restaurant Location</strong><br/>
                  <small>${newAddress}</small>
                </div>
              `)
            }

            drawRadiusCircle(newLat, newLng)
          } else {
            const newAddress = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
            setLocationSearch(newAddress)
            setSelectedAddress(newAddress)
            setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
            drawRadiusCircle(newLat, newLng)
          }
        })
      } else {
        const newAddress = `${newLat.toFixed(6)}, ${newLng.toFixed(6)}`
        setLocationSearch(newAddress)
        setSelectedAddress(newAddress)
        setSelectedLocation({ lat: newLat, lng: newLng, address: newAddress })
        drawRadiusCircle(newLat, newLng)
      }
    })

    markerRef.current = marker
  }

  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "") {
      return location.formattedAddress.trim()
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.city) parts.push(location.city.trim())
    if (location.state) parts.push(location.state.trim())
    if (location.zipCode || location.pincode) parts.push((location.zipCode || location.pincode).trim())
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const handleSaveLocation = async () => {
    if (!selectedLocation) {
      alert("Please select a location on the map first")
      return
    }

    const radius = Number(deliveryRadiusKm)
    if (!Number.isFinite(radius) || radius < 1 || radius > 20) {
      alert("Delivery radius must be between 1 and 20 km")
      return
    }

    try {
      setSaving(true)

      const { lat, lng, address } = selectedLocation

      const payload = {
        deliveryRadiusKm: radius,
        location: {
          ...(restaurantData?.location || {}),
          latitude: lat,
          longitude: lng,
          coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
          formattedAddress: address
        }
      }

      // Update restaurant location
      const response = await restaurantAPI.updateProfile(payload)

      if (response?.data?.data?.restaurant) {
        setRestaurantData(response.data.data.restaurant)
        alert("Location saved successfully!")
        
        // Refresh the page to update navbar
        window.location.reload()
      } else {
        throw new Error("Failed to save location")
      }
    } catch (error) {
      debugError("Error saving location:", error)
      alert(error.response?.data?.message || "Failed to save location. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }

    setFetchingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng })
          mapInstanceRef.current.setZoom(17)
        }
        
        if (geocoderRef.current) {
          geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results[0]) {
              const address = results[0].formatted_address
              setLocationSearch(address)
              setSelectedAddress(address)
              setSelectedLocation({ lat, lng, address })
              updateMarker(lat, lng, address)
              drawRadiusCircle(lat, lng)
            } else {
              const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
              setLocationSearch(address)
              setSelectedAddress(address)
              setSelectedLocation({ lat, lng, address })
              updateMarker(lat, lng, address)
              drawRadiusCircle(lat, lng)
            }
            setFetchingLocation(false)
          })
        } else {
          const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          setLocationSearch(address)
          setSelectedAddress(address)
          setSelectedLocation({ lat, lng, address })
          updateMarker(lat, lng, address)
          drawRadiusCircle(lat, lng)
          setFetchingLocation(false)
        }
      },
      (error) => {
        debugError("Error fetching location:", error)
        alert("Failed to get your current location. Please allow location access in your browser.")
        setFetchingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="restaurant-page min-h-full bg-gray-50">
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            {/* Back Button */}
            <button
              onClick={goBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Delivery Radius</h1>
              <p className="text-sm text-gray-600">Set your restaurant location and delivery radius</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={autocompleteInputRef}
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder="Search for your restaurant location..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={handleUseCurrentLocation}
              disabled={fetchingLocation || mapLoading}
              title="Use current location"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {fetchingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Current Location</span>
            </button>

            <button
              onClick={handleSaveLocation}
              disabled={!selectedLocation || saving}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Location</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Delivery Radius (km)
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={deliveryRadiusKm}
              onChange={(e) => setDeliveryRadiusKm(e.target.value)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              Customers can order, and riders get offers, only within this radius of your restaurant.
            </p>
          </div>

          {selectedLocation && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Selected Location:</strong> {selectedAddress}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          {/* Always render the map div, show loading overlay on top */}
          <div ref={mapRef} className="w-full h-[600px]" style={{ minHeight: '600px' }} />
          {mapLoading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" />
                <p className="text-gray-600">Loading map...</p>
                <p className="text-xs text-gray-400 mt-2">If this takes too long, please refresh the page</p>
              </div>
            </div>
          )}
          {!mapLoading && mapError && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10 p-6">
              <div className="text-center max-w-md">
                <p className="text-red-600 font-semibold mb-2">Unable to load map</p>
                <p className="text-sm text-gray-600 mb-4">{mapError}</p>
                <button
                  type="button"
                  onClick={() => bootstrapZoneMap()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

