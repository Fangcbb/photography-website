"use client";

import { useEffect, useMemo, useState, memo, useRef } from "react";
import Image, { ImageProps } from "next/image";
import { Blurhash } from "react-blurhash";

interface BlurImageProps
  extends Omit<ImageProps, "onLoad" | "onLoadingComplete" | "priority"> {
  blurhash?: string | null;
}

/**
 * BlurImage component displays an image with a blurhash placeholder.
 * onLoad fires when the image finishes loading (including cached).
 */
const BlurImageInner = function BlurImageInner({
  src,
  alt,
  width,
  height,
  fill,
  className,
  blurhash,
  ...props
}: BlurImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  const containerStyle = fill ? "absolute inset-0" : "relative w-full h-full";

  useEffect(() => {
    if (!imageLoaded) return;
    const timeout = window.setTimeout(() => {
      setShowPlaceholder(false);
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [imageLoaded]);

  const showBlurhash = showPlaceholder && blurhash && blurhash.length >= 6;

  return (
    <div className={containerStyle}>
      {showBlurhash && (
        <div
          className={`absolute inset-0 ${
            className ?? ""
          } transition-opacity duration-500 ease-in-out ${
            imageLoaded ? "opacity-0" : "opacity-100"
          }`}
          style={{ pointerEvents: "none" }}
        >
          <Blurhash
            hash={blurhash}
            width="100%"
            height="100%"
            resolutionX={16}
            resolutionY={16}
            punch={1}
          />
        </div>
      )}
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={`${
          className ?? ""
        } transition-opacity duration-500 ease-in-out ${
          imageLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => {
          setImageLoaded(true);
        }}
        onError={() => {
          setShowPlaceholder(false);
          setImageLoaded(true);
        }}
        {...props}
      />
    </div>
  );
};

const BlurImage = memo(function BlurImage(props: BlurImageProps) {
  const srcKey = useMemo(() => {
    const src = props.src;
    if (typeof src === "string") return src;

    if ("src" in src && typeof src.src === "string") {
      return src.src;
    }

    if ("default" in src && src.default && "src" in src.default) {
      return src.default.src;
    }

    return String(src);
  }, [props.src]);

  return <BlurImageInner key={srcKey} {...props} />;
});

export default BlurImage;
