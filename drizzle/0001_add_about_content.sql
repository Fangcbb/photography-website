CREATE TYPE "public"."photo_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."video_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."music_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "about_content" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"name" text DEFAULT 'Fang Bing' NOT NULL,
	"role" text DEFAULT 'Photographer' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar" text DEFAULT '/avatar.jpg',
	"about_heading" text DEFAULT 'About' NOT NULL,
	"about_paragraphs" text[] DEFAULT '{}' NOT NULL,
	"camera_heading" text DEFAULT 'Camera' NOT NULL,
	"camera_subheading" text DEFAULT 'Camera Lenses' NOT NULL,
	"camera_description" text DEFAULT '' NOT NULL,
	"gear" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text,
	"country" text NOT NULL,
	"country_code" text NOT NULL,
	"city" text NOT NULL,
	"cover_photo_id" uuid NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"album" text,
	"music_url" text NOT NULL,
	"cover_url" text,
	"duration" integer,
	"file_size" integer,
	"visibility" "music_visibility" DEFAULT 'public' NOT NULL,
	"genre" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"visibility" "photo_visibility" DEFAULT 'private' NOT NULL,
	"aspect_ratio" real NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"blur_data" text NOT NULL,
	"country" text,
	"country_code" text,
	"region" text,
	"city" text,
	"district" text,
	"full_address" text,
	"place_formatted" text,
	"make" varchar(255),
	"model" varchar(255),
	"lens_model" varchar(255),
	"focal_length" real,
	"focal_length_35mm" real,
	"f_number" real,
	"iso" integer,
	"exposure_time" real,
	"exposure_compensation" real,
	"latitude" real,
	"longitude" real,
	"gps_altitude" real,
	"datetime_original" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid,
	"visibility" "post_visibility" DEFAULT 'private' NOT NULL,
	"tags" text[],
	"cover_image" text,
	"description" text,
	"content" text,
	"reading_time_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_sets" ADD CONSTRAINT "city_sets_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_city_set" ON "city_sets" USING btree ("country","city");--> statement-breakpoint
CREATE INDEX "year_idx" ON "photos" USING btree (DATE_TRUNC('year', "datetime_original"));--> statement-breakpoint
CREATE INDEX "city_idx" ON "photos" USING btree ("city");--> statement-breakpoint
CREATE INDEX "category_idx" ON "posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "tags_idx" ON "posts" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "video_slug_idx" ON "videos" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "video_tags_idx" ON "videos" USING btree ("tags");
