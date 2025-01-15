import { z } from 'zod';

export const showQuizParameters = z.object({
  question: z.string(),
  answer: z.string(),
});

export type ShowQuizParameters = z.infer<typeof showQuizParameters>;

export const showSentenceExplanationParameters = z.object({
  sentence: z.string(),
  explanation: z.string(),
  annotations: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      label: z.string(),
    })
  ),
});

export type ShowSentenceExplanationParameters = z.infer<typeof showSentenceExplanationParameters>;
