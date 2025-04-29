// src/ai/flows/summarize-landmark-info.ts
'use server';

/**
 * @fileOverview Summarizes the description of a landmark using an LLM.
 *
 * - summarizeLandmarkInfo - A function that summarizes the description of a landmark.
 * - SummarizeLandmarkInfoInput - The input type for the summarizeLandmarkInfo function.
 * - SummarizeLandmarkInfoOutput - The return type for the summarizeLandmarkInfo function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizeLandmarkInfoInputSchema = z.object({
  title: z.string().describe('The title of the landmark.'),
  description: z.string().describe('The description of the landmark.'),
  wikipediaUrl: z.string().describe('The URL of the landmark on Wikipedia.'),
});
export type SummarizeLandmarkInfoInput = z.infer<
  typeof SummarizeLandmarkInfoInputSchema
>;

const SummarizeLandmarkInfoOutputSchema = z.object({
  summary: z.string().describe('A short summary of the landmark.'),
});
export type SummarizeLandmarkInfoOutput = z.infer<
  typeof SummarizeLandmarkInfoOutputSchema
>;

export async function summarizeLandmarkInfo(
  input: SummarizeLandmarkInfoInput
): Promise<SummarizeLandmarkInfoOutput> {
  return summarizeLandmarkInfoFlow(input);
}

const summarizeLandmarkInfoPrompt = ai.definePrompt({
  name: 'summarizeLandmarkInfoPrompt',
  input: {
    schema: z.object({
      title: z.string().describe('The title of the landmark.'),
      description: z.string().describe('The description of the landmark.'),
      wikipediaUrl: z.string().describe('The URL of the landmark on Wikipedia.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('A short summary of the landmark.'),
    }),
  },
  prompt: `Summarize the following landmark information in a single sentence.\n\nTitle: {{{title}}}\nDescription: {{{description}}}\nWikipedia URL: {{{wikipediaUrl}}}`,
});

const summarizeLandmarkInfoFlow = ai.defineFlow<
  typeof SummarizeLandmarkInfoInputSchema,
  typeof SummarizeLandmarkInfoOutputSchema
>(
  {
    name: 'summarizeLandmarkInfoFlow',
    inputSchema: SummarizeLandmarkInfoInputSchema,
    outputSchema: SummarizeLandmarkInfoOutputSchema,
  },
  async input => {
    const {output} = await summarizeLandmarkInfoPrompt(input);
    return output!;
  }
);
