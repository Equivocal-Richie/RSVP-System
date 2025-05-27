
import { CreateEventWizard } from "./components/CreateEventWizard";
import { Suspense } from "react";
import { Activity } from "lucide-react";

export const metadata = {
  title: "Create New Event - RSVP Now",
  description: "Step-by-step guide to create your event and send invitations.",
};

export default function CreateEventPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Activity className="h-12 w-12 animate-spin text-primary" /> <span className="ml-4 text-lg">Loading Event Creator...</span></div>}>
      <CreateEventWizard />
    </Suspense>
  );
}
