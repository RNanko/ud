import { categories, iconKeys, type Category, type IconKey } from "./types";
import { exerciseLibrary } from "./library";
export const exerciseIcons = Object.fromEntries(iconKeys.map(key => [key, `/gym/${key}.svg`])) as Record<IconKey, string>;
// Artwork is presentation-only: saved exercise definitions keep their original equipment key.
export const exerciseArtwork: Readonly<Record<string, string>> = Object.fromEntries(exerciseLibrary.map(exercise => [exercise.id, `/gym/artwork/exercises/${exercise.id}.svg`]));
export const categoryIcons = Object.fromEntries(categories.map(category => [category, `/gym/artwork/categories/${category.toLowerCase()}.svg`])) as Record<Category, string>;
