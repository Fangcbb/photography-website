import { db } from "@/db";
import { aboutContent } from "@/db/schema";
import { eq } from "drizzle-orm";

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

export type AboutData = typeof DEFAULT_ABOUT;

export async function getAboutData(): Promise<AboutData> {
  try {
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
      id: row.id,
      name: row.name ?? DEFAULT_ABOUT.name,
      role: row.role ?? DEFAULT_ABOUT.role,
      bio: row.bio ?? DEFAULT_ABOUT.bio,
      avatar: row.avatar ?? DEFAULT_ABOUT.avatar,
      aboutHeading: row.aboutHeading ?? DEFAULT_ABOUT.aboutHeading,
      aboutParagraphs:
        Array.isArray(row.aboutParagraphs) && row.aboutParagraphs.length > 0
          ? row.aboutParagraphs
          : DEFAULT_ABOUT.aboutParagraphs,
      cameraHeading: row.cameraHeading ?? DEFAULT_ABOUT.cameraHeading,
      cameraSubheading: row.cameraSubheading ?? DEFAULT_ABOUT.cameraSubheading,
      cameraDescription: row.cameraDescription ?? DEFAULT_ABOUT.cameraDescription,
      gear: row.gear ?? DEFAULT_ABOUT.gear,
    };
  } catch {
    return DEFAULT_ABOUT;
  }
}
