import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";
import { SignInView } from "@/modules/auth/ui/views/sign-in-view";
import { getSession } from "@/modules/auth/lib/get-session";

export const dynamic = "force-dynamic";

const page = async () => {
  const session = await getSession();

  if (!!session) {
    redirect("/");
  }

  const [cover] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.visibility, "public"), gt(photos.width, photos.height)))
    .orderBy(sql`random()`)
    .limit(1);

  return <SignInView coverId={cover?.id ?? null} />;
};

export default page;
