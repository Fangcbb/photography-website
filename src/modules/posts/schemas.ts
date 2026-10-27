import { z } from "zod";

export const postFormSchema = z.object({
  title: z.string().min(1, {
    message: "标题不能为空",
  }),
  slug: z.string().min(1, {
    message: "URL 别名不能为空",
  }),
  content: z.string().optional(),
  visibility: z.enum(["public", "private"]),
  coverImage: z.string().optional(),
  tags: z.array(z.string()),
  description: z.string().optional(),
});
