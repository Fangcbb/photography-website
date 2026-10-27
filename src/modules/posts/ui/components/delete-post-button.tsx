"use client";

import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirm } from "@/hooks/use-confirm";

interface DeletePostButtonProps {
  postId: string;
  postTitle: string;
}

export function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [ConfirmDialog, confirm] = useConfirm(
    "删除文章",
    `Are you sure you want to delete "${postTitle}"? This action cannot be undone. The post will be permanently deleted.`
  );

  const deletePost = useMutation(trpc.posts.remove.mutationOptions());

  const handleDelete = async () => {
    const ok = await confirm();

    if (!ok) return;

    deletePost.mutate(
      { id: postId },
      {
        onSuccess: async () => {
          // Invalidate queries to refetch posts list
          await queryClient.invalidateQueries(
            trpc.posts.getMany.queryOptions({})
          );
          toast.success("文章删除成功");
        },
        onError: (error) => {
          toast.error(error.message || "文章删除失败");
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
        title="删除文章"
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
