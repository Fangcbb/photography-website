"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveModal } from "@/components/responsive-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhotoUploader } from "./photo-uploader";
import { useState } from "react";

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PhotoUploadModal = ({open, onOpenChange}: PhotoUploadModalProps) => {
  const isMobile = useIsMobile();
  const [isUploading, setIsUploading] = useState(false);

  return (
    <>
      <ResponsiveModal
        title="Upload a photo"
        open={isUploading || open}
        onOpenChange={onOpenChange}
        className={isMobile
          ? "flex flex-col max-h-[85dvh]"
          : "h-[80vh] w-[80vw] max-w-none"
        }
      >
        <ScrollArea className={isMobile ? "flex-1 min-h-0" : "pr-4"}>
          <PhotoUploader onCreateSuccess={() => setIsUploading(false)} />
        </ScrollArea>
      </ResponsiveModal>
    </>
  );
};
