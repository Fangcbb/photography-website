import { z } from "zod";
import { TExifData, TImageInfo } from "@/modules/photos/lib/utils";

// ============================================================================
// FORM SCHEMAS
// ============================================================================

// Helper function to parse exposure time from string to number
// Handles both decimal (e.g., "0.004") and fraction (e.g., "1/250") formats
function parseExposureTime(value: string | number | null | undefined): number | null | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.includes('/')) {
      const [num, den] = value.split('/').map(v => parseFloat(v));
      return den ? num / den : undefined;
    }
    return parseFloat(value) || undefined;
  }
  return undefined;
}

export const firstStepSchema = z.object({
  url: z
    .string()
    .min(1, { message: "请先上传照片再继续" }),
});

export type FirstStepData = z.infer<typeof firstStepSchema>;

// Helper to accept number or empty string
// Accept string or undefined for all fields (form submits strings)
export const secondStepSchema = z.object({
  title: z.string().min(1, { message: "标题不能为空" }),
  description: z.string().min(1, { message: "描述不能为空" }),
  visibility: z.enum(["private", "public"]).default("private"),
  latitude: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  longitude: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  gpsAltitude: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  dateTimeOriginal: z.date().optional(),
  isFavorite: z.boolean().default(false),
  // Camera parameters - accept string or undefined
  make: z.string().optional(),
  model: z.string().optional(),
  lensModel: z.string().optional(),
  focalLength: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  focalLength35mm: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  fNumber: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
  iso: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseInt(v) || undefined : v),
  exposureTime: z.union([z.number(), z.string(), z.null()]).optional().transform(v => parseExposureTime(v)),
  exposureCompensation: z.union([z.number(), z.string()]).optional().transform(v => typeof v === "string" ? parseFloat(v) || undefined : v),
});

export type SecondStepData = z.infer<typeof secondStepSchema>;

export const thirdStepSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type ThirdStepData = z.infer<typeof thirdStepSchema>;

export const fourthStepSchema = z.object({});

export type FourthStepData = z.infer<typeof fourthStepSchema>;

// Combined schema for type inference (exported for use in components)
export const formSchema = z.object({
  ...firstStepSchema.shape,
  ...secondStepSchema.shape,
  ...thirdStepSchema.shape,
  ...fourthStepSchema.shape,
  exif: z.custom<TExifData | null>().optional(),
  imageInfo: z.custom<TImageInfo>().optional(),
});

export type PhotoFormData = z.infer<typeof formSchema>;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface StepProps {
  onNext: (data: Partial<PhotoFormData>) => void;
  onBack?: () => void;
  initialData?: Partial<PhotoFormData>;
  isSubmitting?: boolean;
}

export interface UploadStepProps extends StepProps {
  url: string | null;
  exif: TExifData | null;
  imageInfo: TImageInfo | undefined;
  onUploadSuccess: (
    url: string,
    exif: TExifData | null,
    imageInfo: TImageInfo,
    livePhotoVideoUrl?: string
  ) => void;
  onReupload: (url: string) => void;
}

export interface MetadataStepProps extends StepProps {
  exif: TExifData | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const INITIAL_FORM_VALUES: Partial<PhotoFormData> = {
  url: "",
  title: "",
  description: "",
  visibility: "private",
  isFavorite: false,
};

export const STEP_CONFIG = [
  {
    id: "upload",
    title: "上传",
    description: "上传照片",
  },
  {
    id: "metadata",
    title: "元数据",
    description: "为照片添加元数据",
  },
  {
    id: "location",
    title: "位置",
    description: "为照片添加位置",
  },
  {
    id: "preview",
    title: "预览",
    description: "预览照片",
  },
];
