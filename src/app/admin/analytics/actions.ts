
"use server";

import { getAllEventsForUser, getEventById } from "@/lib/db";
import type { EventData, EventAnalyticRow, AnalyzeEventPerformanceInput, EventAnalysisOutput } from "@/types";
import { analyzeEventPerformance } from '@/ai/flows/analyze-event-performance-flow';

export async function fetchEventAnalyticsData(userId: string): Promise<{ analytics: EventAnalyticRow[], error?: string }> {
  if (!userId) {
    return { analytics: [], error: "User not authenticated." };
  }

  try {
    const events = await getAllEventsForUser(userId); // Assumes events are sorted: most recent first
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
      if (i + 1 < events.length) { // Check if there is a previous event (older event is at i+1 due to sorting)
        const previousEvent = events[i + 1];
        if (currentEvent.seatLimit > 0 && previousEvent.seatLimit > 0) {
          const previousCapacityFilled = (previousEvent.confirmedGuestsCount / previousEvent.seatLimit) * 100;
          if (previousCapacityFilled != null && capacityFilledPercentage != null) { // ensure both are calculable
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


export async function triggerEventAiAnalysis(input: AnalyzeEventPerformanceInput): Promise<EventAnalysisOutput | { error: string }> {
  try {
    // Fetch full event details if only partial data is sent from client
    // For now, assume 'input' contains all necessary fields for the AI flow as defined in AnalyzeEventPerformanceInput
    
    // Example: If you only passed eventId and needed to fetch more details:
    // const eventDetails = await getEventById(input.eventId);
    // if (!eventDetails) return { error: "Event not found for AI analysis." };
    // const fullAiInput: AnalyzeEventPerformanceInput = {
    //   ...input, // could be just eventId from client
    //   eventName: eventDetails.name,
    //   eventDescription: eventDetails.description,
    //   eventDate: eventDetails.date,
    //   confirmedGuests: eventDetails.confirmedGuestsCount,
    //   seatLimit: eventDetails.seatLimit,
    //   // capacityFilledPercentage might need to be recalculated or passed if client has it
    // };
    // const result = await analyzeEventPerformance(fullAiInput);

    const result = await analyzeEventPerformance(input);
    return result;
  } catch (error) {
    console.error("AI Event Analysis Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to perform AI analysis on event.";
    return { error: errorMessage };
  }
}
