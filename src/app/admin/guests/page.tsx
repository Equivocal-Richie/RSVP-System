
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export const metadata = {
  title: "Past Guests - RSVP Now",
  description: "View and manage guests from all your past events.",
};

export default function PastGuestsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-6 w-6 text-primary" />
            Past Guests Management
          </CardTitle>
          <CardDescription>
            This section will allow you to view all guests from your past events, filter them, and export data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Feature coming soon! You'll be able to see a comprehensive list of everyone who has been invited to any of your events, their RSVP status, and export options.
          </p>
          {/* Placeholder for future table and export button */}
        </CardContent>
      </Card>
    </div>
  );
}
