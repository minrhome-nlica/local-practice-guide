import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    level: z.string().default('入門'),
    updated: z.coerce.date(),
    status: z.string().default('示範稿'),
    related: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  })
});

export const collections = { entries };