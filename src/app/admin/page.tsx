import DashboardClient from "./components/DashboardClient";
import { Suspense } from "react";
import { Activity } from "lucide-react";

// Metadata for Admin page
export const metadata = {
  title: "Admin Dashboard - RSVP Now",
  description: "Manage your event, view guest RSVPs, and access statistics.",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Activity className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-lg">Loading Dashboard...</span></div>}>
      <DashboardClient />
    </Suspense>
  );
}
