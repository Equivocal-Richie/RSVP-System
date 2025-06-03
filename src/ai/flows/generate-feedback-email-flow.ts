
'use server';
/**
 * @fileOverview A Genkit flow to generate email text for requesting event feedback.
 *
 * - generateEventFeedbackEmail - Generates email body for feedback requests.
 * - GenerateFeedbackEmailInput - Input schema for the flow.
 * - GenerateFeedbackEmailOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { GenerateFeedbackEmailInput, GenerateFeedbackEmailOutput } from '@/types';

const GenerateFeedbackEmailInputSchema = z.object({
  eventName: z.string().describe('The name of the event for which feedback is being requested.'),
  guestName: z.string().describe("The guest's full name."),
});

const GenerateFeedbackEmailOutputSchema = z.object({
  subject: z.string().describe('The subject line for the feedback request email.'),
  greeting: z.string().describe('A personalized greeting for the guest.'),
  body: z.string().describe('The main body of the email, politely requesting feedback and providing context.'),
  closing: z.string().describe('A suitable closing for the email.'),
  fullEmailText: z.string().describe('The combined full text of the email (greeting, body, closing).')
});

const generateFeedbackEmailPrompt = ai.definePrompt({
  name: 'generateEventFeedbackEmailPrompt',
  input: { schema: GenerateFeedbackEmailInputSchema },
  output: { schema: GenerateFeedbackEmailOutputSchema },
  prompt: `You are an event follow-up assistant. Your task is to craft a polite and concise email to request feedback from a guest who attended an event.

  Event Name: {{{eventName}}}
  Guest Name: {{{guestName}}}

  Instructions:
  1.  Create a subject line like "Your Feedback on {{{eventName}}} Matters!" or "Share Your Thoughts: {{{eventName}}}".
  2.  Create a personalized greeting for {{{guestName}}}.
  3.  Write an engaging email body that:
      *   Thanks them for attending {{{eventName}}}.
      *   Briefly mentions that their feedback is valuable for future events.
      *   States that a link to a short feedback form will be provided (the actual link will be inserted into the email template later, you don't need to generate it).
  4.  Write a suitable closing (e.g., "Best regards," or "Sincerely,").
  5.  Combine these into 'fullEmailText' with appropriate line breaks.

  Example Output:
  {
    "subject": "Share Your Thoughts: {{{eventName}}}",
    "greeting": "Hi {{{guestName}}},",
    "body": "Thank you for attending {{{eventName}}}! We hope you had a wonderful time. Your feedback is incredibly valuable to us and helps us make future events even better. We'd be grateful if you could take a few moments to share your thoughts via the feedback link.",
    "closing": "Sincerely,\\nThe Event Team",
    "fullEmailText": "Hi {{{guestName}}},\\n\\nThank you for attending {{{eventName}}}! We hope you had a wonderful time. Your feedback is incredibly valuable to us and helps us make future events even better. We'd be grateful if you could take a few moments to share your thoughts via the feedback link.\\n\\nSincerely,\\nThe Event Team"
  }

  Ensure the output is in the specified JSON format.
  `,
});


const generateEventFeedbackEmailFlowInternal = ai.defineFlow(
  {
    name: 'generateEventFeedbackEmailFlowInternal',
    inputSchema: GenerateFeedbackEmailInputSchema,
    outputSchema: GenerateFeedbackEmailOutputSchema,
  },
  async (input) => {
    const { output } = await generateFeedbackEmailPrompt(input);
    if (!output) {
        throw new Error("AI failed to generate feedback email text.");
    }
    // Construct fullEmailText if not directly provided by model (older models might not combine)
    if (!output.fullEmailText && output.greeting && output.body && output.closing) {
        output.fullEmailText = `${output.greeting}\n\n${output.body}\n\n${output.closing}`;
    }
    return output;
  }
);

export async function generateEventFeedbackEmail(input: GenerateFeedbackEmailInput): Promise<GenerateFeedbackEmailOutput> {
    return generateEventFeedbackEmailFlowInternal(input);
}
