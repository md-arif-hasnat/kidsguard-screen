"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

type RemoteImageProps = Omit<ImageProps, "loader" | "unoptimized">;

function passthroughLoader({ src }: ImageLoaderProps) {
  return src;
}

export default function RemoteImage({ alt, ...props }: RemoteImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      loader={passthroughLoader}
      unoptimized
    />
  );
}
