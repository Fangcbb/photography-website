"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/hooks/use-confirm";

interface DeletePhotoButtonProps {
  photoId: string;
  photoTitle: string;
}

export function DeletePhotoButton({
  photoId,
  photoTitle,
}: DeletePhotoButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [ConfirmDialog, confirm] = useConfirm(
    "删除照片",
    `Are you sure you want to delete "${photoTitle}"? This action cannot be undone. The photo will be permanently deleted.`
  );

  const deletePhoto = useMutation(trpc.photos.remove.mutationOptions());

  const handleDelete = async () => {
    const ok = await confirm();

    if (!ok) return;

    deletePhoto.mutate(
      { id: photoId },
      {
        onSuccess: async () => {
          // Invalidate queries to refetch photos list
          await queryClient.invalidateQueries(
            trpc.photos.getMany.queryOptions({})
          );
          toast.success("照片删除成功");
        },
        onError: (error) => {
          toast.error(error.message || "照片删除失败");
        },
      }
    );
  };

  return (
    <>
      <ConfirmDialog />
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        title="删除照片"
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
