
import { Suspense } from "react";
import { Activity } from "lucide-react";
import AnalyticsClient from "./components/AnalyticsClient";

export const metadata = {
  title: "Event Analytics - RSVP Now",
  description: "View analytics and performance for your past events.",
};

export default function EventAnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Activity className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-lg">Loading Analytics...</span></div>}>
      <AnalyticsClient />
    </Suspense>
  );
}
