import { db } from "./src/db";
import { photos, citySets } from "./src/db/schema";
import { sql, desc } from "drizzle-orm";

const q = db
  .select({
    city: citySets.city,
    photoCount: sql<number>`(select count(*) from ${photos} where ${photos.city} = ${citySets.city} and ${photos.country} = ${citySets.country} and ${photos.visibility} = 'public')`.mapWith(Number),
  })
  .from(citySets)
  .orderBy(desc(citySets.updatedAt))
  .limit(3);

console.log(JSON.stringify(q.toSQL(), null, 1));
process.exit(0);
