
import { config } from 'dotenv';
config();

import '@/ai/flows/tabulate-rsvps.ts';
import '@/ai/flows/generate-invitation-text-flow.ts';
import '@/ai/flows/analyze-event-performance-flow.ts'; // Added new flow
