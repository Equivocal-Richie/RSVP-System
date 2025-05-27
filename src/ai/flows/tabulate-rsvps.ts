'use server';

/**
 * @fileOverview A flow to tabulate RSVP statistics and automatically send reminders to unresponsive guests.
 *
 * - tabulateRsvpStats - A function that orchestrates the tabulation and reminder process.
 * - TabulateRsvpStatsInput - The input type for the tabulateRsvpStats function.
 * - TabulateRsvpStatsOutput - The return type for the tabulateRsvpStats function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TabulateRsvpStatsInputSchema = z.object({
  eventDetails: z.string().describe('Details about the event, including date, time, and location.'),
  guestList: z.string().describe('A list of guests and their RSVP status (confirmed, pending, declined).'),
});
export type TabulateRsvpStatsInput = z.infer<typeof TabulateRsvpStatsInputSchema>;

const TabulateRsvpStatsOutputSchema = z.object({
  summary: z.string().describe('A summary of the RSVP statistics, including confirmed, pending, and declined counts.'),
  guestsToRemind: z.array(z.string()).describe('A list of guest identifiers who have not yet responded and should be reminded.'),
});
export type TabulateRsvpStatsOutput = z.infer<typeof TabulateRsvpStatsOutputSchema>;

export async function tabulateRsvpStats(input: TabulateRsvpStatsInput): Promise<TabulateRsvpStatsOutput> {
  return tabulateRsvpStatsFlow(input);
}

const summarizeRsvpPrompt = ai.definePrompt({
  name: 'summarizeRsvpPrompt',
  input: {schema: TabulateRsvpStatsInputSchema},
  output: {schema: TabulateRsvpStatsOutputSchema},
  prompt: `You are an event management assistant. You are provided with event details and a guest list with RSVP statuses.

  Event Details: {{{eventDetails}}}
  Guest List: {{{guestList}}}

  Your task is to summarize the RSVP statistics (confirmed, pending, declined) and identify guests who need to be reminded.
  Return the summary of the RSVP statistics and a list of guest identifiers who have not yet responded in JSON format.
  Make sure that the "guestsToRemind" field is a list of strings.
  Here is an example of the JSON format:
  {
    "summary": "Confirmed: 100, Pending: 50, Declined: 20",
    "guestsToRemind": ["guest123", "guest456"]
  }`,
});

const tabulateRsvpStatsFlow = ai.defineFlow(
  {
    name: 'tabulateRsvpStatsFlow',
    inputSchema: TabulateRsvpStatsInputSchema,
    outputSchema: TabulateRsvpStatsOutputSchema,
  },
  async input => {
    const {output} = await summarizeRsvpPrompt(input);
    return output!;
  }
);
