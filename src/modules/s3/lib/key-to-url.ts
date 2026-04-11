const BASE_URL = process.env.NEXT_PUBLIC_S3_PUBLIC_URL || "";

export const keyToUrl = (key: string | undefined | null, suffix?: string) => {
  if (!key) {
    return "";
  }

  if (suffix) {
    return `${BASE_URL}/${key}/${suffix}`;
  }

  return `${BASE_URL}/${key}`;
};
