import BlurImage from "@/components/blur-image";
import { CitySetSummary } from "@/db/schema";
import { photoProxyUrl } from "@/lib/photo-url";
import VectorCombined from "@/components/vector-combined";

interface CoverPhotoProps {
  citySet: CitySetSummary;
  citySets: CitySetSummary[];
}

export const CoverPhoto = ({ citySet, citySets }: CoverPhotoProps) => {
  return (
    <div className="w-full h-[70vh] lg:w-1/2 lg:fixed lg:top-0 lg:left-0 lg:h-screen p-0 lg:p-3">
      <div className="w-full h-full relative rounded-xl overflow-hidden">
        {/* Cover photo */}
        <div className="relative w-full h-full">
          {citySets?.map((city) => {
            const isActive = city.id === citySet.id;
            return (
              <div
                key={city.id}
                className={`absolute inset-0 transition-opacity duration-300 ${
                  isActive ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <BlurImage
                  // 当前城市用大图保证全屏封面清晰，其余城市只需占位级分辨率
                  src={photoProxyUrl(
                    city.coverPhoto.id,
                    isActive ? "hero" : "fangb"
                  )}
                  alt={city.city}
                  fill
                  quality={isActive ? 85 : 80}
                  blurhash={city.coverPhoto.blurData}
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            );
          })}
        </div>

        <div className="absolute right-0 bottom-0 z-10">
          <VectorCombined title={citySet?.city || ""} position="bottom-right" />
        </div>
      </div>
    </div>
  );
};
