import { relations } from "drizzle-orm/relations";
import { user, session, categories, posts, photos, citySets, account } from "./schema";

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const postsRelations = relations(posts, ({one}) => ({
	category: one(categories, {
		fields: [posts.categoryId],
		references: [categories.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	posts: many(posts),
}));

export const citySetsRelations = relations(citySets, ({one}) => ({
	photo: one(photos, {
		fields: [citySets.coverPhotoId],
		references: [photos.id]
	}),
}));

export const photosRelations = relations(photos, ({many}) => ({
	citySets: many(citySets),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));