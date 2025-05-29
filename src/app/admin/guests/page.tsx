
import { Suspense } from "react";
import { Activity } from "lucide-react";
import PastGuestsClient from "./components/PastGuestsClient"; // Changed import

export const metadata = {
  title: "Past Guests - RSVP Now",
  description: "View and manage guests from all your past events.",
};

export default function PastGuestsPage() {
  return (
    // Wrapped with Suspense for better loading experience
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <Activity className="h-12 w-12 animate-spin text-primary" /> 
        <span className="ml-4 text-lg">Loading Past Guests...</span>
      </div>
    }>
      <PastGuestsClient />
    </Suspense>
  );
}
