
"use server";

import { getAllEventsForUser } from "@/lib/db";
import type { EventData, EventAnalyticRow } from "@/types";

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
        // If one or both don't have seat limits, comparison is less direct.
        // Could compare raw confirmed counts if needed, but keeping to percentage for now.
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
