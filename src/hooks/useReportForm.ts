import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { getCurrentLocation, LocationData } from "../utils/location";
import { IssueReport } from "../types";

export function useReportForm(onSubmit: (report: Partial<IssueReport>) => void) {
  const [image, setImage] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [category, setCategory] = useState("Pothole & Roads");
  const [description, setDescription] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFetchLocation = () => {
    setLocLoading(true);
    setLocError(null);
    getCurrentLocation(
      (data) => {
        setLocation(data);
        setLocLoading(false);
      },
      (err) => {
        setLocError(err);
        setLocLoading(false);
      }
    );
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!image) return;

    onSubmit({
      image,
      lat: location?.lat,
      lng: location?.lng,
      locationName: manualAddress || location?.addressPlaceholder || "Current Location",
      category,
      description: description || "No additional description provided.",
    });
  };

  return {
    image,
    location,
    locLoading,
    locError,
    category,
    setCategory,
    description,
    setDescription,
    manualAddress,
    setManualAddress,
    fileInputRef,
    handleImageChange,
    triggerFileSelect,
    handleFetchLocation,
    handleRemoveImage,
    handleSubmit,
  };
}
