import { InferSelectModel, relations, sql } from "drizzle-orm";
import {
  boolean,
  timestamp,
  pgTable,
  text,
  real,
  varchar,
  integer,
  uuid,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";

// ⌚️ Reusable timestamps - Define once, use everywhere!
export const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
};

/***************
 ****************
 *  User Table  *
 ****************
 ***************/

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

/***************
 ****************
 *  Photo Table *
 ****************
 ***************/

export const photoVisibility = pgEnum("photo_visibility", [
  "public",
  "private",
]);

export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    visibility: photoVisibility("visibility").default("private").notNull(),
    aspectRatio: real("aspect_ratio").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    blurData: text("blur_data").notNull(),

    country: text("country"),
    countryCode: text("country_code"),
    region: text("region"),
    city: text("city"),
    district: text("district"),

    fullAddress: text("full_address"),
    placeFormatted: text("place_formatted"),

    make: varchar("make", { length: 255 }),
    model: varchar("model", { length: 255 }),
    lensModel: varchar("lens_model", { length: 255 }),
    focalLength: real("focal_length"),
    focalLength35mm: real("focal_length_35mm"),
    fNumber: real("f_number"),
    iso: integer("iso"),
    exposureTime: real("exposure_time"),
    exposureCompensation: real("exposure_compensation"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    gpsAltitude: real("gps_altitude"),
    dateTimeOriginal: timestamp("datetime_original"),

    ...timestamps,
  },
  (t) => [
    index("year_idx").on(sql`DATE_TRUNC('year', ${t.dateTimeOriginal})`),
    index("city_idx").on(t.city),
  ]
);

export const citySets = pgTable(
  "city_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    description: text("description"),

    // GEO DATA
    country: text("country").notNull(),
    countryCode: text("country_code").notNull(),
    city: text("city").notNull(),

    // COVER PHOTO
    coverPhotoId: uuid("cover_photo_id")
      .references(() => photos.id)
      .notNull(),

    photoCount: integer("photo_count").default(0).notNull(),

    // META DATA
    ...timestamps,
  },
  (t) => [uniqueIndex("unique_city_set").on(t.country, t.city)]
);

// Soft relations
export const citySetsRelations = relations(citySets, ({ one, many }) => ({
  coverPhoto: one(photos, {
    fields: [citySets.coverPhotoId],
    references: [photos.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  citySet: one(citySets, {
    fields: [photos.country, photos.city],
    references: [citySets.country, citySets.city],
  }),
}));

// Schema
export const photosInsertSchema = createInsertSchema(photos).extend({
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().min(1, { message: "Description is required" }),
});
export const photosSelectSchema = createSelectSchema(photos);
export const photosUpdateSchema = createUpdateSchema(photos)
  .pick({
    id: true,
    title: true,
    description: true,
    isFavorite: true,
    latitude: true,
    longitude: true,
    visibility: true,
  })
  .partial();

// Types
export type Photo = InferSelectModel<typeof photos>;
export type CitySet = InferSelectModel<typeof citySets>;
// 概览接口返回的精简类型（不含 photos 数组）
export type CitySetSummary = {
  id: string;
  city: string;
  country: string;
  photoCount: number;
  coverPhotoId: string;
  coverPhoto: Photo;
};

// with photos & cover photo
export type CitySetWithPhotos = CitySet & { photos: Photo[] } & {
  coverPhoto: Photo;
};

/***************
 ****************
 *  Post Table  *
 ****************
 ***************/

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const postVisibility = pgEnum("post_visibility", ["public", "private"]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id").references(() => categories.id),
    visibility: postVisibility("visibility").default("private").notNull(),
    tags: text("tags").array(),
    coverImage: text("cover_image"),
    description: text("description"),
    content: text("content"),
    readingTimeMinutes: integer("reading_time_minutes"),

    ...timestamps,
  },
  (t) => [
    index("category_idx").on(t.categoryId),
    index("tags_idx").on(t.tags),
    index("slug_idx").on(t.slug),
  ]
);

// Types
export type Post = InferSelectModel<typeof posts>;

// Schema
export const postsInsertSchema = createInsertSchema(posts);
export const postsSelectSchema = createSelectSchema(posts);
export const postsUpdateSchema = createUpdateSchema(posts);

/***************
 ****************
 *  Video Table *
 ****************
 ***************/

export const videoVisibility = pgEnum("video_visibility", ["public", "private"]);

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    
    // 视频文件信息
    videoUrl: text("video_url").notNull(),           // 视频 URL（COS）
    videoDuration: integer("video_duration"),        // 时长（秒）
    thumbnailUrl: text("thumbnail_url"),             // 缩略图 URL
    videoSize: integer("video_size"),                // 文件大小（字节）
    
    // 元数据
    visibility: videoVisibility("visibility").default("private").notNull(),
    tags: text("tags").array(),
    viewCount: integer("view_count").default(0).notNull(),
    
    // 拍摄时间
    dateTimeOriginal: timestamp("datetime_original"),
    
    // 地理位置
    latitude: real("latitude"),
    longitude: real("longitude"),
    country: text("country"),
    countryCode: text("country_code"),
    city: text("city"),
    
    ...timestamps,
  },
  (t) => [
    index("video_slug_idx").on(t.slug),
    index("video_tags_idx").on(t.tags),
  ]
);

// Types
export type Video = InferSelectModel<typeof videos>;

// Schema
export const videosInsertSchema = createInsertSchema(videos).extend({
  title: z.string().min(1, { message: "Title is required" }),
  videoUrl: z.string().min(1, { message: "Video URL is required" }),
});
export const videosSelectSchema = createSelectSchema(videos);
export const videosUpdateSchema = createUpdateSchema(videos)
  .pick({
    id: true,
    title: true,
    description: true,
    thumbnailUrl: true,
    visibility: true,
    tags: true,
  })
  .partial();

/***************
 ****************
 *  Music Table *
 ****************
 ***************/

export const musicVisibility = pgEnum("music_visibility", ["public", "private"]);

export const music = pgTable(
  "music",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    artist: text("artist"),
    album: text("album"),
    
    // 音乐文件信息
    musicUrl: text("music_url").notNull(),           // 音乐文件 URL（COS）
    coverUrl: text("cover_url"),                     // 唱片封面 URL（同名 jpg）
    duration: integer("duration"),                   // 时长（秒）
    fileSize: integer("file_size"),                  // 文件大小（字节）
    
    // 元数据
    visibility: musicVisibility("visibility").default("public").notNull(),
    genre: text("genre"),                            // 流派
    playCount: integer("play_count").default(0).notNull(),
    
    ...timestamps,
  }
);

// Types
export type Music = InferSelectModel<typeof music>;

// Schema
export const musicInsertSchema = createInsertSchema(music).extend({
  title: z.string().min(1, { message: "Title is required" }),
  musicUrl: z.string().min(1, { message: "Music URL is required" }),
});
export const musicSelectSchema = createSelectSchema(music);
export const musicUpdateSchema = createUpdateSchema(music)
  .pick({
    id: true,
    title: true,
    artist: true,
    album: true,
    coverUrl: true,
    visibility: true,
    genre: true,
  })
  .partial();

/***************
 ****************
 * About Content *
 ****************
 ***************/

export const aboutContent = pgTable("about_content", {
  id: varchar("id", { length: 50 }).primaryKey().default("default"),

  // Profile
  name: text("name").notNull().default("Fang Bing"),
  role: text("role").notNull().default("Photographer"),
  bio: text("bio").notNull().default(""),
  avatar: text("avatar").default("/avatar.jpg"),

  // About card
  aboutHeading: text("about_heading").notNull().default("About"),
  aboutParagraphs: text("about_paragraphs").array().notNull().default([]),

  // Camera card
  cameraHeading: text("camera_heading").notNull().default("Camera"),
  cameraSubheading: text("camera_subheading").notNull().default("Camera Lenses"),
  cameraDescription: text("camera_description").notNull().default(""),

  // Gear list
  gear: text("gear").notNull().default("[]"), // JSON array of {brand, model}

  ...timestamps,
});

export type AboutContent = InferSelectModel<typeof aboutContent>;
export const aboutContentInsertSchema = createInsertSchema(aboutContent);
export const aboutContentUpdateSchema = createUpdateSchema(aboutContent).partial();
