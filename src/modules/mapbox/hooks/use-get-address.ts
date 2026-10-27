import { useState, useEffect } from "react";
import { Feature, FeatureCollection, Point } from "geojson";

export interface MapboxFeature extends Feature {
  geometry: Point;
  properties: {
    full_address: string;
    name: string;
    place_formatted: string;
    context: {
      country: {
        country_code: string;
        name: string;
      };
      locality: {
        name: string;
      } | null;
      place: {
        name: string;
      } | null;
      region: {
        name: string;
      } | null;
    };
  };
}

export interface MapboxReverseGeocodingResponse extends FeatureCollection {
  features: MapboxFeature[];
  query: [number, number];
}

export type AddressData = MapboxReverseGeocodingResponse | null;

type LocationState = {
  data: MapboxReverseGeocodingResponse | null;
  isLoading: boolean;
  error: string | null;
};

interface UseGetLocationProps {
  lat: number;
  lng: number;
}

export const useGetAddress = ({ lat, lng }: UseGetLocationProps) => {
  const [state, setState] = useState<LocationState>({
    data: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // FORM-01 收尾：拖动标记时连续触发逆地理，旧响应晚到会把过期地址写入表单。
    // 用 AbortController + unmounted 标志确保只有最新坐标的响应生效。
    const controller = new AbortController();
    let cancelled = false;

    const fetchLocation = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `/mbapi/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&language=en&access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: MapboxReverseGeocodingResponse = await response.json();
        if (cancelled) return;
        setState({ data, isLoading: false, error: null });
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({
          data: null,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch location",
        });
      }
    };

    fetchLocation();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lat, lng]);

  return state;
};
