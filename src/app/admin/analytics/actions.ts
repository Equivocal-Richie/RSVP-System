
"use server";

import { getAllEventsForUser, getEventById, getFeedbackForEvent } from "@/lib/db";
import type { EventData, EventAnalyticRow, AnalyzeEventPerformanceInput, EventAnalysisOutput, EventFeedbackData } from "@/types";
import { analyzeEventPerformance } from '@/ai/flows/analyze-event-performance-flow';

export async function fetchEventAnalyticsData(userId: string): Promise<{ analytics: EventAnalyticRow[], error?: string }> {
  if (!userId) {
    return { analytics: [], error: "User not authenticated." };
  }

  try {
    const events = await getAllEventsForUser(userId); 
    if (!events || events.length === 0) {
      return { analytics: [] };
    }

    const analyticsRows: EventAnalyticRow[] = [];

    for (let i = 0; i < events.length; i++) {
      const currentEvent = events[i];
      let capacityFilledPercentage: number | null = null;
      if (currentEvent.seatLimit > 0) {
        capacityFilledPercentage = (currentEvent.confirmedGuestsCount / currentEvent.seatLimit) * 100;
      }

      let changeFromPreviousPercentage: number | null = null;
      if (i + 1 < events.length) { 
        const previousEvent = events[i + 1];
        if (currentEvent.seatLimit > 0 && previousEvent.seatLimit > 0) {
          const previousCapacityFilled = (previousEvent.confirmedGuestsCount / previousEvent.seatLimit) * 100;
          if (previousCapacityFilled != null && capacityFilledPercentage != null) { 
             changeFromPreviousPercentage = capacityFilledPercentage - previousCapacityFilled;
          }
        }
      }
      
      analyticsRows.push({
        eventId: currentEvent.id,
        eventName: currentEvent.name,
        eventDate: currentEvent.date,
        confirmedGuests: currentEvent.confirmedGuestsCount,
        seatLimit: currentEvent.seatLimit,
        capacityFilledPercentage: capacityFilledPercentage,
        changeFromPreviousPercentage: changeFromPreviousPercentage,
      });
    }

    return { analytics: analyticsRows };
  } catch (error) {
    console.error("Error fetching event analytics data:", error);
    return { analytics: [], error: "Failed to fetch event analytics." };
  }
}

export async function fetchAndPrepareFeedbackSummary(eventId: string): Promise<string | undefined> {
  if (!eventId) return undefined;

  try {
    const feedbackItems = await getFeedbackForEvent(eventId);
    if (!feedbackItems || feedbackItems.length === 0) {
      return "No guest feedback was submitted for this event.";
    }

    // Simple summarization: Concatenate key details from each feedback item.
    // For a large number of feedback items, a more sophisticated summarization (e.g., an AI flow) would be better.
    let summary = "Guest Feedback Summary:\n";
    feedbackItems.slice(0, 10).forEach((fb, index) => { // Limit to first 10 for brevity in this example
      summary += `\nFeedback ${index + 1} (From: ${fb.guestNameAtTimeOfFeedback}, Rating: ${fb.rating}/5):\n`;
      summary += `  Liked Most: ${fb.likedMost.substring(0, 150)}${fb.likedMost.length > 150 ? '...' : ''}\n`;
      if (fb.suggestionsForImprovement) {
        summary += `  Suggestions: ${fb.suggestionsForImprovement.substring(0, 150)}${fb.suggestionsForImprovement.length > 150 ? '...' : ''}\n`;
      }
    });
    if (feedbackItems.length > 10) {
        summary += `\n... and ${feedbackItems.length - 10} more feedback entries.`;
    }
    
    // Limit total summary length to avoid excessively long AI prompts
    const MAX_SUMMARY_LENGTH = 2000; // Adjust as needed
    if (summary.length > MAX_SUMMARY_LENGTH) {
        summary = summary.substring(0, MAX_SUMMARY_LENGTH - 3) + "...";
    }

    return summary;
  } catch (error) {
    console.error(`Error fetching or summarizing feedback for event ${eventId}:`, error);
    return "Could not retrieve or summarize guest feedback due to an error.";
  }
}


export async function triggerEventAiAnalysis(input: AnalyzeEventPerformanceInput): Promise<EventAnalysisOutput | { error: string }> {
  try {
    // Input should now contain guestFeedbackSummary if fetched by the client-calling action
    const result = await analyzeEventPerformance(input);
    return result;
  } catch (error) {
    console.error("AI Event Analysis Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to perform AI analysis on event.";
    return { error: errorMessage };
  }
}
