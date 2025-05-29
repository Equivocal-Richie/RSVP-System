
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
  emailType: z.enum(['initialInvitation', 'publicRsvpConfirmed', 'publicRsvpWaitlisted', 'waitlistAccepted', 'waitlistDeclined']).optional().describe("The type of email to generate, influencing the tone and content."),
  adjustmentInstructions: z.string().optional().describe("Optional instructions to adjust or refine the previously generated email text.")
});
export type GenerateInvitationTextInput = z.infer<typeof GenerateInvitationTextInputSchema>;

const GenerateInvitationTextOutputSchema = z.object({
  greeting: z.string().describe('A personalized greeting for the guest.'),
  body: z.string().describe('The main body of the email, tailored to the emailType and event details.'),
  closing: z.string().describe('A suitable closing for the email.'),
  fullEmailText: z.string().describe('The combined full text of the email (greeting, body, closing).')
});
export type GenerateInvitationTextOutput = z.infer<typeof GenerateInvitationTextOutputSchema>;


const generateEmailPrompt = ai.definePrompt({
  name: 'generateInvitationEmailPrompt',
  input: { schema: GenerateInvitationTextInputSchema },
  output: { schema: GenerateInvitationTextOutputSchema },
  prompt: `You are an expert event communication assistant. Your task is to craft a targeted and engaging email.

  Event Details:
  - Name: {{{eventName}}}
  - Description: {{{eventDescription}}}
  - Mood: {{{eventMood}}}

  Guest Name: {{{guestName}}}
  Email Type: {{{emailType}}}

  {{#if adjustmentInstructions}}
  You have previously generated an email for this event and guest, or are refining an initial draft. Please revise it based on the following instructions:
  "{{{adjustmentInstructions}}}"
  Focus on incorporating these adjustments while maintaining the core event details, specified mood, and email type.
  {{else}}
  Base your response on the 'Email Type'.

  {{#if (eq emailType "initialInvitation")}}
  Instructions for 'initialInvitation':
  1.  Create a personalized greeting for {{{guestName}}}.
  2.  Write an engaging email body that warmly invites them to {{{eventName}}}, reflecting the event mood. Briefly mention the event purpose.
  3.  Write a suitable closing.
  Example for 'casual' mood 'Tech Meetup' for guest 'Alex Doe':
  {
    "greeting": "Hey Alex Doe!",
    "body": "Hope you're doing well! Just wanted to personally invite you to our upcoming Tech Meetup. It's going to be a relaxed get-together with some cool talks and networking. We'd love to see you there and chat about all things tech.",
    "closing": "Cheers,\\nThe Event Team",
    "fullEmailText": "Hey Alex Doe!\\n\\nHope you're doing well! Just wanted to personally invite you to our upcoming Tech Meetup. It's going to be a relaxed get-together with some cool talks and networking. We'd love to see you there and chat about all things tech.\\n\\nCheers,\\nThe Event Team"
  }
  {{else if (eq emailType "publicRsvpConfirmed")}}
  Instructions for 'publicRsvpConfirmed':
  1.  Create a welcoming greeting for {{{guestName}}}.
  2.  Confirm their successful RSVP for {{{eventName}}}. Mention that their spot is secured. Include a brief, enthusiastic sentence about the event.
  3.  Provide a polite closing.
  Example for 'celebratory' mood 'Annual Gala' for guest 'Jamie Lee':
  {
    "greeting": "Dear Jamie Lee,",
    "body": "Great news! Your RSVP for the Annual Gala has been successfully confirmed. We're thrilled you'll be joining us for a night of celebration and connection. Get ready for an unforgettable evening!",
    "closing": "See you there,\\nThe Gala Committee",
    "fullEmailText": "Dear Jamie Lee,\\n\\nGreat news! Your RSVP for the Annual Gala has been successfully confirmed. We're thrilled you'll be joining us for a night of celebration and connection. Get ready for an unforgettable evening!\\n\\nSee you there,\\nThe Gala Committee"
  }
  {{else if (eq emailType "publicRsvpWaitlisted")}}
  Instructions for 'publicRsvpWaitlisted':
  1.  Create a polite greeting for {{{guestName}}}.
  2.  Inform them they have been added to the waitlist for {{{eventName}}} because it's currently at capacity.
  3.  Briefly explain that they will be notified if a spot becomes available.
  4.  Provide a hopeful and polite closing.
  Example for 'professional' mood 'Tech Conference' for guest 'Sam Ray':
  {
    "greeting": "Hello Sam Ray,",
    "body": "Thank you for your interest in the Tech Conference! The event is currently at full capacity, so we've added you to our waitlist. We'll notify you immediately if a spot opens up. We appreciate your understanding.",
    "closing": "Sincerely,\\nThe Conference Organizers",
    "fullEmailText": "Hello Sam Ray,\\n\\nThank you for your interest in the Tech Conference! The event is currently at full capacity, so we've added you to our waitlist. We'll notify you immediately if a spot opens up. We appreciate your understanding.\\n\\nSincerely,\\nThe Conference Organizers"
  }
  {{else if (eq emailType "waitlistAccepted")}}
  Instructions for 'waitlistAccepted':
  1. Create an enthusiastic greeting for {{{guestName}}}.
  2. Announce that a spot has opened up for {{{eventName}}} and their RSVP is now confirmed.
  3. Briefly reiterate excitement for their attendance.
  4. Provide a welcoming closing.
    Example for 'casual' mood 'Workshop' for guest 'Chris P.':
  {
    "greeting": "Great News, Chris P.!",
    "body": "Good news! A spot has opened up for you at our Workshop on {{{eventName}}}, and your RSVP is now confirmed! We're really looking forward to having you join us.",
    "closing": "See you soon,\\nThe Workshop Team",
    "fullEmailText": "Great News, Chris P.!\\n\\nGood news! A spot has opened up for you at our Workshop on {{{eventName}}}, and your RSVP is now confirmed! We're really looking forward to having you join us.\\n\\nSee you soon,\\nThe Workshop Team"
  }
  {{else if (eq emailType "waitlistDeclined")}}
  Instructions for 'waitlistDeclined' (admin declined waitlisted guest):
  1. Create a polite and understanding greeting for {{{guestName}}}.
  2. Gently inform them that, unfortunately, a spot did not become available for {{{eventName}}} from the waitlist for this event.
  3. Express gratitude for their interest and perhaps mention future opportunities.
  4. Provide a courteous closing.
  Example:
  {
    "greeting": "Dear {{{guestName}}},",
    "body": "Thank you again for your interest in {{{eventName}}}. While we had hoped a spot would become available from the waitlist, we unfortunately weren't able to accommodate additional guests for this particular event. We truly appreciate your understanding and hope to see you at future events.",
    "closing": "Best regards,\\nThe Event Organizers",
    "fullEmailText": "Dear {{{guestName}}},\\n\\nThank you again for your interest in {{{eventName}}}. While we had hoped a spot would become available from the waitlist, we unfortunately weren't able to accommodate additional guests for this particular event. We truly appreciate your understanding and hope to see you at future events.\\n\\nBest regards,\\nThe Event Organizers"
  }
  {{else}}
  Generate a generic event-related email based on the event details and mood.
  {
    "greeting": "Hello {{{guestName}}},",
    "body": "This is regarding the event: {{{eventName}}}. We wanted to reach out with some information. The event is described as '{{{eventDescription}}}' and has a '{{{eventMood}}}' feel.",
    "closing": "Thanks,\\nThe Event Team",
    "fullEmailText": "Hello {{{guestName}}},\\n\\nThis is regarding the event: {{{eventName}}}. We wanted to reach out with some information. The event is described as '{{{eventDescription}}}' and has a '{{{eventMood}}}' feel.\\n\\nThanks,\\nThe Event Team"
  }
  {{/if}}
  {{/if}}

  Ensure the output is in the specified JSON format, with 'greeting', 'body', 'closing', and 'fullEmailText' fields.
  The 'fullEmailText' should be the combination of greeting, body, and closing, with appropriate line breaks (e.g., \\n\\n between paragraphs).
  `,
});


const generateInvitationTextFlowInternal = ai.defineFlow(
  {
    name: 'generateInvitationTextFlowInternal',
    inputSchema: GenerateInvitationTextInputSchema,
    outputSchema: GenerateInvitationTextOutputSchema,
  },
  async (input) => {
    // Set default emailType if not provided, for initial invitations
    const effectiveInput = { ...input, emailType: input.emailType || 'initialInvitation' };
    const { output } = await generateEmailPrompt(effectiveInput);
    if (!output) {
        throw new Error("AI failed to generate invitation text.");
    }
    return output;
  }
);

export async function generatePersonalizedInvitation(input: GenerateInvitationTextInput): Promise<GenerateInvitationTextOutput> {
    return generateInvitationTextFlowInternal(input);
}
