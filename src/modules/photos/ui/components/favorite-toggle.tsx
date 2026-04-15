"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePhotosFilters } from "../../hooks/use-photos-filters";

interface FavoriteToggleProps {
  photoId: string;
  initialValue: boolean;
}

export function FavoriteToggle({ photoId, initialValue }: FavoriteToggleProps) {
  const [isFavorite, setIsFavorite] = useState(initialValue);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [filters] = usePhotosFilters();

  const updatePhoto = useMutation(trpc.photos.update.mutationOptions());

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const newValue = !isFavorite;

    // Optimistic update — update immediately for snappy UX
    setIsFavorite(newValue);

    // Directly write to query cache instead of relying on invalidation
    // This guarantees the UI sees the updated data immediately
    const queryKey = trpc.photos.getMany.queryOptions({ ...filters }).queryKey;
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map((photo: any) =>
          photo.id === photoId ? { ...photo, isFavorite: newValue } : photo
        ),
      };
    });

    updatePhoto.mutate(
      {
        id: photoId,
        isFavorite: newValue,
      },
      {
        onSuccess: () => {
          toast.success(
            newValue ? "Added to favorites" : "Removed from favorites"
          );
        },
        onError: (error) => {
          // Revert optimistic update on error
          setIsFavorite(!newValue);
          // Also revert the cache
          queryClient.setQueryData(queryKey, (old: any) => {
            if (!old?.items) return old;
            return {
              ...old,
              items: old.items.map((photo: any) =>
                photo.id === photoId ? { ...photo, isFavorite: !newValue } : photo
              ),
            };
          });
          toast.error(error.message || "Failed to update favorite status");
        },
      }
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={updatePhoto.isPending}
      className={cn(
        "h-8 w-8 transition-colors",
        isFavorite && "text-red-500 hover:text-red-600"
      )}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn("size-6 transition-all", isFavorite && "fill-current")}
      />
    </Button>
  );
}
