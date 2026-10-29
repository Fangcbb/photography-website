import { s3Client } from "@/modules/s3/lib/server-client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const s3Router = createTRPCRouter({
  deleteFile: protectedProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { key } = input;
        const command = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        });
        await s3Client.send(command);
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "文件删除失败",
        });
      }
    }),
});
