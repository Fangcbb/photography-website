import { drizzle } from "drizzle-orm/node-postgres";
import { sql, desc } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { Pool } from "pg";

const photos = pgTable("photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  city: text("city"), country: text("country"),
  visibility: text("visibility").default("public").notNull(),
});
const citySets = pgTable("city_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  city: text("city").notNull(), country: text("country").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }));
const q = db.select({
  city: citySets.city,
  photoCount: sql<number>`(select count(*) from ${photos} where ${photos.city} = ${citySets.city} and ${photos.country} = ${citySets.country} and ${photos.visibility} = 'public')`.mapWith(Number),
}).from(citySets).orderBy(desc(citySets.updatedAt)).limit(3);
console.log(JSON.stringify(q.toSQL()));
const rows = await q;
console.log(JSON.stringify(rows));
process.exit(0);
