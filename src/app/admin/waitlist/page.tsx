
import { Suspense } from "react";
import { Activity } from "lucide-react";
import WaitlistClient from "./components/WaitlistClient";

export const metadata = {
  title: "Waitlist Management - RSVP Now",
  description: "Manage guests on the waitlist for your events.",
};

export default function WaitlistManagementPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <Activity className="h-12 w-12 animate-spin text-primary" /> 
        <span className="ml-4 text-lg">Loading Waitlist...</span>
      </div>
    }>
      <WaitlistClient />
    </Suspense>
  );
}
