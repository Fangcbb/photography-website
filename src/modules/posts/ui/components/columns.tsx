"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PostGetMany } from "../../types";
import { VisibilityToggle } from "./visibility-toggle";
import { DeletePostButton } from "./delete-post-button";
import Link from "next/link";
import { PenBoxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const columns: ColumnDef<PostGetMany[number]>[] = [
  {
    accessorKey: "title",
    header: "标题",
  },
  {
    accessorKey: "visibility",
    header: "可见性",
    cell: ({ row }) => {
      return (
        <VisibilityToggle
              key={row.original.id}
          photoId={row.original.id}
          initialValue={row.original.visibility}
        />
      );
    },
  },
  {
    id: "actions",
    header: "操作",
    cell: ({ row }) => {
      return (
        <>
          <DeletePostButton
            postId={row.original.id}
            postTitle={row.original.title}
          />

          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/posts/${row.original.slug}`}>
              <PenBoxIcon className="h-4 w-4" />
            </Link>
          </Button>
        </>
      );
    },
  },
];
