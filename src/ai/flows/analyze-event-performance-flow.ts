
'use server';
/**
 * @fileOverview A Genkit flow to analyze event performance and provide suggestions.
 *
 * - analyzeEventPerformance - Analyzes event data and provides insights.
 * - AnalyzeEventPerformanceInput - Input schema for the flow.
 * - EventAnalysisOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeEventPerformanceInput, EventAnalysisOutput } from '@/types';

// Schemas are defined in @/types to be shared with server actions
const AnalyzeEventPerformanceInputSchema = z.object({
  eventId: z.string(),
  eventName: z.string().describe('The name of the event.'),
  eventDescription: z.string().describe('A brief description of the event.'),
  eventDate: z.string().describe('The date the event was held.'),
  confirmedGuests: z.number().describe('Number of guests who confirmed attendance.'),
  seatLimit: z.number().describe('The seating capacity of the event. 0 or negative means unlimited.'),
  capacityFilledPercentage: z.number().nullable().describe('Percentage of seats filled (if applicable).'),
  guestFeedbackSummary: z.string().optional().describe('A summary of guest feedback received post-event. This could include common themes, overall sentiment, or specific positive/negative points.'),
});

const EventAnalysisOutputSchema = z.object({
  insights: z.array(z.string()).describe('Key observations and insights about the event performance.'),
  suggestions: z.array(z.string()).describe('Actionable suggestions to improve future events.'),
  overallSentiment: z.string().optional().describe('Overall sentiment analysis based on available data (e.g., feedback, attendance patterns).'),
});

const analyzeEventPrompt = ai.definePrompt({
  name: 'analyzeEventPerformancePrompt',
  input: { schema: AnalyzeEventPerformanceInputSchema },
  output: { schema: EventAnalysisOutputSchema },
  prompt: `You are an expert event analyst AI. Your task is to analyze the provided event data and generate actionable insights and suggestions for the event organizer.

Event Data:
- Event Name: {{{eventName}}}
- Description: {{{eventDescription}}}
- Date Held: {{{eventDate}}}
- Confirmed Guests: {{{confirmedGuests}}}
- Seat Limit: {{#if (eq seatLimit 0)}}Unlimited{{else}}{{{seatLimit}}}{{/if}}
- Capacity Filled: {{#if capacityFilledPercentage}}{{{capacityFilledPercentage}}}%{{else}}N/A (unlimited capacity or no data){{/if}}

{{#if guestFeedbackSummary}}
Guest Feedback Summary:
{{{guestFeedbackSummary}}}
{{else}}
(No guest feedback summary was provided for this analysis)
{{/if}}

Analysis Task:
1.  **Insights**: Based on all available data (including guest feedback if provided), provide 2-3 key insights about the event's performance. Consider aspects like attendance relative to capacity, common themes from feedback (e.g., if feedback mentions "great speakers" or "poor catering"). If capacity was low, what might be reasons? If high, what did they do well? How did feedback align with attendance?
2.  **Suggestions**: Provide 3-4 concrete, actionable suggestions for the event organizer to improve their next event. These suggestions should be data-driven where possible. For example, if feedback highlights issues with venue, suggest considering alternatives. If capacity was an issue, suggest strategies. If description is very generic and attendance was low, suggest improving it. If feedback was overwhelmingly positive about a certain aspect, suggest leveraging that in future promotions.
3.  **Overall Sentiment (Optional based on feedback)**: If guest feedback was provided, briefly summarize the overall sentiment (e.g., "Largely positive with minor concerns about X", "Mixed, with strong points in Y but issues in Z", "Overwhelmingly positive"). If no feedback, state "Sentiment analysis pending guest feedback data."

Format your response strictly as JSON conforming to the EventAnalysisOutput schema, ensuring 'insights' and 'suggestions' are arrays of strings.

Example Insight (with feedback): "The event achieved a strong {{{capacityFilledPercentage}}}% capacity fill rate, and guest feedback consistently praised the engaging workshop content, indicating this format resonates well with the target audience."
Example Insight (no feedback): "The event had a moderate capacity fill rate of {{{capacityFilledPercentage}}}%, indicating room for improvement in attracting attendees or adjusting capacity."
Example Suggestion (with feedback): "Given the positive feedback on the keynote speaker, consider featuring similar high-profile speakers in future events and highlight them in promotional materials."
Example Suggestion (no feedback): "Consider targeted pre-event marketing to boost attendance for events with similar capacity utilization."
`,
});

const analyzeEventPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeEventPerformanceFlow',
    inputSchema: AnalyzeEventPerformanceInputSchema,
    outputSchema: EventAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeEventPrompt(input);
    if (!output) {
      throw new Error("AI failed to generate event analysis.");
    }
    // Ensure insights and suggestions are always arrays, even if AI fails to populate them
    return {
        insights: output.insights || ["AI analysis could not generate specific insights at this time."],
        suggestions: output.suggestions || ["AI analysis could not generate specific suggestions at this time."],
        overallSentiment: output.overallSentiment
    };
  }
);

export async function analyzeEventPerformance(input: AnalyzeEventPerformanceInput): Promise<EventAnalysisOutput> {
  return analyzeEventPerformanceFlow(input);
}
