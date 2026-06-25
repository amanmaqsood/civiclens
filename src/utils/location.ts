export interface LocationData {
  lat: number;
  lng: number;
  accuracy?: number;
  addressPlaceholder?: string;
  error?: string;
}

export function getCurrentLocation(
  onSuccess: (data: LocationData) => void,
  onError: (errorMsg: string) => void
) {
  if (!navigator.geolocation) {
    onError("Geolocation is not supported by your browser.");
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 0,
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        accuracy: position.coords.accuracy,
        addressPlaceholder: `Latitude: ${position.coords.latitude.toFixed(4)}, Longitude: ${position.coords.longitude.toFixed(4)}`,
      });
    },
    (err) => {
      let errorMessage = "Unable to retrieve your location.";
      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = "Location permission denied. Please allow it or enter details manually.";
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = "Location information is unavailable.";
          break;
        case err.TIMEOUT:
          errorMessage = "Location request timed out.";
          break;
      }
      onError(errorMessage);
    },
    options
  );
}
