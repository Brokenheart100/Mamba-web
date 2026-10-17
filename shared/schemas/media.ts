import { z } from "zod";

const nonnegative = z.number().nonnegative();
const progressText = z.string().refine((value) => value.length < 4000);

export const watchProgressSchema = z.object({
  key: z.string(),
  subjectId: z.number().int().positive(),
  episodeId: z.number().int().positive(),
  subjectName: progressText,
  episodeName: progressText,
  image: progressText,
  sourceId: progressText,
  channel: progressText,
  sort: nonnegative,
  position: nonnegative,
  duration: nonnegative,
  updatedAt: nonnegative.max(8_640_000_000_000_000),
  completed: z.boolean(),
}).refine((row) => row.key === `${row.subjectId}:${row.episodeId}`, {
  message: "观看记录编号与条目不一致。",
  path: ["key"],
});

export const progressBackupSchema = z.object({
  version: z.literal(1),
  progress: z.array(watchProgressSchema).max(10_000),
});

export const sourcePreferencesSchema = z.array(z.string());
