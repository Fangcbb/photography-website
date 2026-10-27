"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { postFormSchema } from "../../schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PostGetOne } from "../../types";
import { generateSlug } from "../../lib/utils";
import { useEffect } from "react";
import FileUploader from "@/modules/s3/ui/components/file-uploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "./tags-input";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import TiptapEditor from "@/components/editor";

const formSchema = postFormSchema;

interface PostFormProps {
  post?: PostGetOne;
}

export const PostForm = ({ post }: PostFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createPost = useMutation(
    trpc.posts.create.mutationOptions({
      onSuccess: async (data) => {
        toast.success("文章创建成功");
        await queryClient.invalidateQueries(
          trpc.posts.getMany.queryOptions({})
        );
        await queryClient.invalidateQueries(trpc.blog.getMany.queryOptions({}));
        form.reset();
        router.push(`/dashboard/posts/${data.slug}`);
      },
      onError: (e) => {
        toast.error("文章创建失败", {
          description: e.message,
        });
      },
    })
  );

  const updatePost = useMutation(
    trpc.posts.update.mutationOptions({
      onSuccess: async (data) => {
        toast.success("文章更新成功");
        await queryClient.invalidateQueries(
          trpc.posts.getOne.queryOptions({ slug: data.slug })
        );
        await queryClient.invalidateQueries(
          trpc.posts.getMany.queryOptions({})
        );
        await queryClient.invalidateQueries(trpc.blog.getMany.queryOptions({}));
        form.reset();
        router.push(`/dashboard/posts/${data.slug}`);
      },
      onError: (e) => {
        toast.error("文章更新失败", {
          description: e.message,
        });
      },
    })
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: post?.title || "",
      slug: post?.slug || "",
      content: post?.content || "",
      visibility: post?.visibility || "public",
      coverImage: post?.coverImage || "",
      tags: post?.tags || [],
    },
  });

  const title = form.watch("title");

  useEffect(() => {
    if (title) {
      const slug = generateSlug(title);
      form.setValue("slug", slug);
    }
  }, [title, form]);

  const isPending = createPost.isPending || updatePost.isPending;

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (post) {
      updatePost.mutate({ ...values, id: post.id });
    } else {
      createPost.mutate(values);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          <div className="space-y-6 md:col-span-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题</FormLabel>
                  <FormControl>
                    <Input placeholder="标题" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL 别名</FormLabel>
                  <FormControl>
                    <Input placeholder="post-url-slug" {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>封面图</FormLabel>
                  <FormControl>
                    <FileUploader
                      onUploadSuccess={(key) => {
                        field.onChange(key);
                      }}
                      folder="posts"
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>内容</FormLabel>
                  <FormControl>
                    <TiptapEditor
                      content={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标签</FormLabel>
                  <FormControl>
                    <TagsInput
                      value={Array.isArray(field.value) ? field.value : []}
                      onChange={(tags) => field.onChange(tags)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button type="submit" disabled={isPending}>
                {post ? "更新" : "创建"}
              </Button>
            </div>
          </div>
          {/* Right Form Section */}
          <div className="space-y-6 md:col-span-1 md:sticky md:top-24 self-start">
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>可见性</FormLabel>
                  <FormControl>
                    <Select
                      {...field}
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择可见性" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">公开</SelectItem>
                        <SelectItem value="private">私密</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  );
};
