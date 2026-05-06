import { createTRPCRouter, protectedProcedure, baseProcedure } from "@/trpc/init";
import { db } from "@/db";
import { aboutContent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const DEFAULT_ABOUT = {
  id: "default",
  name: "Fang Bing",
  role: "Photographer",
  bio: "我是方斌，一名业余摄影师。在业余时间，我喜欢用镜头记录生活和旅行中的美好瞬间。对我来说，摄影是一种排解孤独的方式。希望你能喜欢我的照片。",
  avatar: "/avatar.jpg",
  aboutHeading: "About",
  aboutParagraphs: [
    "To me, photography is defined by content, not equipment or specs. Its value lies not in high pixels or soft bokeh, but in the emotions, stories, and vision a photograph carries.",
    "Gear sets the upper limit of image quality, but the depth and soul of a work are always decided by the eye and mind behind the lens. The person behind the camera matters more than the camera itself.",
    "I respect the role of good equipment, but reject gear-obsession. No one remembers a photo for its camera brand—but people never forget a powerful story.",
  ],
  cameraHeading: "Camera",
  cameraSubheading: "Camera Lenses",
  cameraDescription:
    "I have a passion for photography and camera lenses. I use a variety of lenses to capture the beauty of nature and people in their different moments.",
  gear: JSON.stringify([
    { brand: "NIKON", model: "Z8 / Z63 / D610" },
    { brand: "LENS", model: "24-120mm f/4 S / 24-70mm f/2.8E ED VR / 70-200mm f/2.8 VR S / 180-600mm f/5.6-6.3 VR" },
    { brand: "DJI", model: "Osmo Pocket 3 / Osmo Action 5 Pro" },
    { brand: "TRIPOD", model: "Leofoto AZ-235C+LH-30R / Marsace MT34SV+MV30" },
    { brand: "OTHER", model: "AD 200 / AD 600 / Cotton Carrier G3" },
  ]),
};

export const aboutRouter = createTRPCRouter({
  /**
   * Get about content (public)
   */
  get: baseProcedure.query(async () => {
    const rows = await db
      .select()
      .from(aboutContent)
      .where(eq(aboutContent.id, "default"))
      .limit(1);

    if (rows.length === 0) {
      return DEFAULT_ABOUT;
    }

    const row = rows[0];
    return {
      ...row,
      aboutParagraphs: row.aboutParagraphs ?? DEFAULT_ABOUT.aboutParagraphs,
      gear: row.gear ?? DEFAULT_ABOUT.gear,
    };
  }),

  /**
   * Update about content (protected)
   */
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        role: z.string().optional(),
        bio: z.string().optional(),
        avatar: z.string().optional(),
        aboutHeading: z.string().optional(),
        aboutParagraphs: z.array(z.string()).optional(),
        cameraHeading: z.string().optional(),
        cameraSubheading: z.string().optional(),
        cameraDescription: z.string().optional(),
        gear: z.string().optional(), // JSON string
      })
    )
    .mutation(async ({ input }) => {
      // Check if record exists
      const existing = await db
        .select()
        .from(aboutContent)
        .where(eq(aboutContent.id, "default"))
        .limit(1);

      if (existing.length === 0) {
        // Insert with defaults merged with input
        await db.insert(aboutContent).values({
          ...DEFAULT_ABOUT,
          ...input,
          id: "default",
        });
      } else {
        // Update only provided fields
        await db
          .update(aboutContent)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(aboutContent.id, "default"));
      }

      return { success: true };
    }),
});
