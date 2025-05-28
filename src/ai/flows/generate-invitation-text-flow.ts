
'use server';
/**
 * @fileOverview A Genkit flow to generate personalized invitation email text.
 *
 * - generatePersonalizedInvitation - Generates email body based on event and guest details.
 * - GenerateInvitationTextInput - Input schema for the flow.
 * - GenerateInvitationTextOutput - Output schema for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { EventMood } from '@/types';

const GenerateInvitationTextInputSchema = z.object({
  eventName: z.string().describe('The name of the event.'),
  eventDescription: z.string().describe('A brief description of the event.'),
  eventMood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed']).describe('The overall mood or theme of the event.'),
  guestName: z.string().describe("The guest's full name."),
  adjustmentInstructions: z.string().optional().describe("Optional instructions to adjust or refine the previously generated email text.")
});
export type GenerateInvitationTextInput = z.infer<typeof GenerateInvitationTextInputSchema>;

const GenerateInvitationTextOutputSchema = z.object({
  greeting: z.string().describe('A personalized greeting for the guest.'),
  body: z.string().describe('The main body of the invitation email, including personalized touches and event mentions.'),
  closing: z.string().describe('A suitable closing for the email.'),
  fullEmailText: z.string().describe('The combined full text of the email (greeting, body, closing).')
});
export type GenerateInvitationTextOutput = z.infer<typeof GenerateInvitationTextOutputSchema>;


const generateEmailPrompt = ai.definePrompt({
  name: 'generateInvitationEmailPrompt',
  input: { schema: GenerateInvitationTextInputSchema },
  output: { schema: GenerateInvitationTextOutputSchema },
  prompt: `You are an expert event invitation writer. Your task is to craft a warm and engaging invitation email.
  
  Event Details:
  - Name: {{{eventName}}}
  - Description: {{{eventDescription}}}
  - Mood: {{{eventMood}}}

  Guest Name: {{{guestName}}}

  {{#if adjustmentInstructions}}
  You have previously generated an invitation. Please revise it based on the following instructions:
  "{{{adjustmentInstructions}}}"
  
  Focus on incorporating these adjustments while maintaining the core event details and the specified mood.
  {{else}}
  Instructions:
  1.  Create a personalized greeting for {{{guestName}}}.
  2.  Write an engaging email body that incorporates the event name and reflects the specified event mood. Briefly mention the event.
  3.  Write a suitable closing.
  4.  Combine these into a 'fullEmailText' field.
  {{/if}}

  Example for a 'casual' mood for 'Tech Meetup' for guest 'Alex Doe' (without adjustment instructions):
  {
    "greeting": "Hey Alex Doe!",
    "body": "Hope you're doing well! Just wanted to personally invite you to our upcoming Tech Meetup. It's going to be a relaxed get-together with some cool talks and networking. We'd love to see you there and chat about all things tech.",
    "closing": "Cheers,\nThe Event Team",
    "fullEmailText": "Hey Alex Doe!\\n\\nHope you're doing well! Just wanted to personally invite you to our upcoming Tech Meetup. It's going to be a relaxed get-together with some cool talks and networking. We'd love to see you there and chat about all things tech.\\n\\nCheers,\\nThe Event Team"
  }
  
  Ensure the output is in the specified JSON format.
  `,
});


const generateInvitationTextFlowInternal = ai.defineFlow( // Renamed to avoid conflict
  {
    name: 'generateInvitationTextFlowInternal', // Renamed
    inputSchema: GenerateInvitationTextInputSchema,
    outputSchema: GenerateInvitationTextOutputSchema,
  },
  async (input) => {
    const { output } = await generateEmailPrompt(input);
    if (!output) {
        throw new Error("AI failed to generate invitation text.");
    }
    return output;
  }
);

// Export a wrapper function for easier invocation from server actions
export async function generatePersonalizedInvitation(input: GenerateInvitationTextInput): Promise<GenerateInvitationTextOutput> {
    return generateInvitationTextFlowInternal(input); // Call the renamed internal flow
}
