import Image from "next/image";

type BrandConfigType = {
  src: string;
  width: number;
  height: number;
};

/**
 * BrandsLogo component displays a brand logo like Canon, Nikon, etc.
 */
export const BrandsLogo = ({
  brand,
  width,
  height,
  className = "",
}: {
  brand: string;
  width?: number;
  height?: number;
  className?: string;
}) => {
  // Define default configurations for each brand
  const brandConfigs: Record<string, BrandConfigType> = {
    sony: { src: "/Sony_logo.svg", width: 80, height: 20 },
    nikon: { src: "/Nikon_Logo.svg", width: 40, height: 40 },
    canon: { src: "/Canon_logo.svg", width: 80, height: 20 },
    fujifilm: { src: "/Fujifilm_logo.svg", width: 90, height: 25 },
    hasselblad: { src: "/Hasselblad_logo.svg", width: 120, height: 30 },
    leica: { src: "/Leica_logo.svg", width: 40, height: 40 },
    lumix: { src: "/Lumix_logo.svg", width: 90, height: 30 },
    olympus: { src: "/Olympus_logo.svg", width: 100, height: 30 },
    pentax: { src: "/Pentax_Logo.svg", width: 90, height: 30 },
    ricoh: { src: "/Ricoh_logo.svg", width: 90, height: 30 },
    sigma: { src: "/Sigma_logo.svg", width: 80, height: 30 },
    apple: { src: "/Apple_logo.svg", width: 30, height: 35 },
    dji: { src: "/DJI_logo.svg", width: 50, height: 30 },
  };

  // Normalize brand name - remove spaces, dashes, and convert to lowercase
  const normalizedBrand = brand.replace(/[\s\-]+/g, "").toLowerCase();
  
  // Map full brand names to short keys
  const brandMappings: Record<string, string> = {
    "nikon": "nikon", "nikoncorporation": "nikon", "nikoncorp": "nikon",
    "canon": "canon", "canoninc": "canon", "canonco": "canon",
    "sony": "sony", "sonycorporation": "sony", "sonycorp": "sony",
    "fujifilm": "fujifilm", "fujifilmcorporation": "fujifilm", "fujifilmcorp": "fujifilm",
    "hasselblad": "hasselblad",
    "leica": "leica", "leicacamera": "leica", "leicacameras": "leica",
    "lumix": "lumix", "panasonic": "lumix",
    "olympus": "olympus", "olympuscorporation": "olympus", "olympuscorp": "olympus",
    "pentax": "pentax", "pentaxricoh": "pentax",
    "sigma": "sigma", "sigmacorporation": "sigma",
    "apple": "apple", "appleinc": "apple",
    "dji": "dji", "djisdk": "dji", "djitechnology": "dji",
  };
  
  // Get the short brand key from the mapping
  const shortBrand = brandMappings[normalizedBrand];
  
  // Find matching brand config
  const config = shortBrand && brandConfigs[shortBrand] 
    ? brandConfigs[shortBrand] 
    : { src: "/placeholder.svg", width: 40, height: 40 };

  return (
    <Image
      src={config.src}
      alt={brand}
      width={width || config.width}
      height={height || config.height}
      className={`object-contain ${className}`}
      unoptimized
    />
  );
};
