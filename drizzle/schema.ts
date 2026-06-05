import { pgTable, index, uuid, text, boolean, real, varchar, integer, timestamp, foreignKey, unique, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const musicVisibility = pgEnum("music_visibility", ['public', 'private'])
export const photoVisibility = pgEnum("photo_visibility", ['public', 'private'])
export const postVisibility = pgEnum("post_visibility", ['public', 'private'])
export const videoVisibility = pgEnum("video_visibility", ['public', 'private'])


export const photos = pgTable("photos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	url: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	isFavorite: boolean("is_favorite").default(false).notNull(),
	visibility: photoVisibility().default('private').notNull(),
	aspectRatio: real("aspect_ratio").notNull(),
	width: real().notNull(),
	height: real().notNull(),
	blurData: text("blur_data").notNull(),
	country: text(),
	countryCode: text("country_code"),
	region: text(),
	city: text(),
	district: text(),
	fullAddress: text("full_address"),
	placeFormatted: text("place_formatted"),
	make: varchar({ length: 255 }),
	model: varchar({ length: 255 }),
	lensModel: varchar("lens_model", { length: 255 }),
	focalLength: real("focal_length"),
	focalLength35Mm: real("focal_length_35mm"),
	fNumber: real("f_number"),
	iso: integer(),
	exposureTime: real("exposure_time"),
	exposureCompensation: real("exposure_compensation"),
	latitude: real(),
	longitude: real(),
	gpsAltitude: real("gps_altitude"),
	datetimeOriginal: timestamp("datetime_original", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("city_idx").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("year_idx").using("btree", sql`date_trunc('year'::text, datetime_original)`),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}),
	unique("session_token_unique").on(table.token),
]);

export const categories = pgTable("categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
});

export const posts = pgTable("posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	slug: text().notNull(),
	categoryId: uuid("category_id"),
	visibility: postVisibility().default('private').notNull(),
	tags: text().array(),
	coverImage: text("cover_image"),
	description: text(),
	content: text(),
	readingTimeMinutes: integer("reading_time_minutes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("category_idx").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	index("slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("tags_idx").using("btree", table.tags.asc().nullsLast().op("array_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "posts_category_id_categories_id_fk"
		}),
	unique("posts_slug_unique").on(table.slug),
]);

export const citySets = pgTable("city_sets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	description: text(),
	country: text().notNull(),
	countryCode: text("country_code").notNull(),
	city: text().notNull(),
	coverPhotoId: uuid("cover_photo_id").notNull(),
	photoCount: integer("photo_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	slug: text().notNull(),
}, (table) => [
	uniqueIndex("unique_city_set").using("btree", table.country.asc().nullsLast().op("text_ops"), table.city.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.coverPhotoId],
			foreignColumns: [photos.id],
			name: "city_sets_cover_photo_id_photos_id_fk"
		}),
	unique("city_sets_slug_unique").on(table.slug),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}),
]);

export const videos = pgTable("videos", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	slug: text().notNull(),
	description: text(),
	videoUrl: text("video_url").notNull(),
	videoDuration: integer("video_duration"),
	thumbnailUrl: text("thumbnail_url"),
	videoSize: integer("video_size"),
	visibility: videoVisibility().default('private').notNull(),
	tags: text().array(),
	viewCount: integer("view_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	datetimeOriginal: timestamp("datetime_original", { mode: 'string' }),
	latitude: real(),
	longitude: real(),
	country: text(),
	countryCode: text("country_code"),
	city: text(),
}, (table) => [
	index("video_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("video_tags_idx").using("btree", table.tags.asc().nullsLast().op("array_ops")),
	unique("videos_slug_unique").on(table.slug),
]);

export const music = pgTable("music", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	artist: text(),
	album: text(),
	musicUrl: text("music_url").notNull(),
	coverUrl: text("cover_url"),
	duration: integer(),
	fileSize: integer("file_size"),
	visibility: musicVisibility().default('public').notNull(),
	genre: text(),
	playCount: integer("play_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const aboutContent = pgTable("about_content", {
	id: varchar({ length: 50 }).default('default').primaryKey().notNull(),
	name: text().default('Fang Bing').notNull(),
	role: text().default('Photographer').notNull(),
	bio: text().default(').notNull(),
	avatar: text().default('/avatar.jpg'),
	aboutHeading: text("about_heading").default('About').notNull(),
	aboutParagraphs: text("about_paragraphs").array().default([""]).notNull(),
	cameraHeading: text("camera_heading").default('Camera').notNull(),
	cameraSubheading: text("camera_subheading").default('Camera Lenses').notNull(),
	cameraDescription: text("camera_description").default(').notNull(),
	gear: text().default('[]').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});
