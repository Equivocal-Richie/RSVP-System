
"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { submitRsvp, type RsvpFormState } from "../actions";
import { useToast } from "@/hooks/use-toast";
import type { InvitationData, EventData, RsvpStatus } from "@/types";
import { AlertCircle, CheckCircle2, PartyPopper, UserX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const RsvpFormSchemaClient = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  status: z.enum(["confirmed", "declining"]), // Changed from attending
});

type RsvpFormValues = z.infer<typeof RsvpFormSchemaClient>;

interface RsvpFormProps {
  invitation: InvitationData;
  event: EventData;
}

function SubmitButton({ currentStatus }: { currentStatus?: RsvpStatus }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting..." : (currentStatus === 'pending' ? "Submit RSVP" : "Update RSVP")}
    </Button>
  );
}

export default function RsvpFormComponent({ invitation, event }: RsvpFormProps) {
  const { toast } = useToast();
  const [formSubmittedSuccessfully, setFormSubmittedSuccessfully] = useState(false);
  const [finalRsvpStatus, setFinalRsvpStatus] = useState<RsvpStatus | null>(null);

  const initialState: RsvpFormState = { message: "", success: false };
  const [state, formAction] = useFormState(submitRsvp, initialState);

  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(RsvpFormSchemaClient),
    defaultValues: {
      name: invitation.guestName || invitation.originalGuestName || "",
      email: invitation.guestEmail || invitation.originalGuestEmail || "",
      // Ensure status is 'confirmed' or 'declining' if it's not 'pending' or 'waitlisted'
      status: (invitation.status === 'confirmed' || invitation.status === 'declining') ? invitation.status : undefined,
    },
  });

  const isEventFull = event.confirmedGuestsCount >= event.seatLimit;
  const alreadyConfirmed = invitation.status === 'confirmed';

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast({
          title: "Success!",
          description: state.message,
          variant: "default",
        });
        setFormSubmittedSuccessfully(true);
        setFinalRsvpStatus(state.updatedInvitation?.status as RsvpStatus);
        if (state.updatedInvitation) {
          form.reset({
            name: state.updatedInvitation.guestName,
            email: state.updatedInvitation.guestEmail,
            status: (state.updatedInvitation.status === 'confirmed' || state.updatedInvitation.status === 'declining') ? state.updatedInvitation.status : undefined,
          });
        }
      } else {
        toast({
          title: "Error",
          description: state.message,
          variant: "destructive",
        });
        if (state.errors?.name) form.setError("name", { type: "server", message: state.errors.name.join(", ") });
        if (state.errors?.email) form.setError("email", { type: "server", message: state.errors.email.join(", ") });
        if (state.errors?.status) form.setError("status", { type: "server", message: state.errors.status.join(", ") });
      }
    }
  }, [state, toast, form]);

  if (formSubmittedSuccessfully || ((invitation.status === 'confirmed' || invitation.status === 'declining') && !form.formState.isDirty && !state.message)) {
    const currentDisplayStatus = finalRsvpStatus || invitation.status;
    return (
      <Alert variant={currentDisplayStatus === 'confirmed' ? "default" : "destructive"} className="shadow-md">
        {currentDisplayStatus === 'confirmed' ? 
          <PartyPopper className="h-5 w-5" /> : 
          <UserX className="h-5 w-5" />
        }
        <AlertTitle>{currentDisplayStatus === 'confirmed' ? "You're Confirmed!" : "RSVP Recorded"}</AlertTitle>
        <AlertDescription>
          {currentDisplayStatus === 'confirmed' 
            ? `Thank you, ${form.getValues().name}! We've recorded your RSVP as confirmed. We look forward to seeing you at ${event.name}.`
            : `Thank you, ${form.getValues().name}. We've recorded your RSVP as declining for ${event.name}.`}
          {(currentDisplayStatus === 'waitlisted') && `You have been added to the waitlist for ${event.name}. We will notify you if a spot becomes available.`}
          <p className="mt-2 text-xs">You can update your RSVP on this page if your plans change, subject to availability.</p>
        </AlertDescription>
         <Button onClick={() => {
           setFormSubmittedSuccessfully(false);
           state.message = ""; 
           state.success = false;
           state.errors = undefined;
           state.updatedInvitation = undefined;
          }} className="mt-4">
            Change RSVP
          </Button>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle>RSVP for {event.name}</CardTitle>
        <CardDescription>Please confirm your attendance below.</CardDescription>
      </CardHeader>
      <form action={formAction} onSubmit={form.handleSubmit(()=>formAction(new FormData(form.control._formValuesIncludingDisabled)))}>
        <CardContent className="space-y-6">
          <input type="hidden" name="invitationId" value={invitation.id} />
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Your full name"
              className={form.formState.errors.name ? "border-destructive" : ""}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="your.email@example.com"
              className={form.formState.errors.email ? "border-destructive" : ""}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Will you attend?</Label>
            <RadioGroup
              name="status"
              onValueChange={(value) => form.setValue("status", value as "confirmed" | "declining", { shouldValidate: true })}
              defaultValue={(invitation.status === 'confirmed' || invitation.status === 'declining') ? invitation.status : undefined}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem 
                  value="confirmed" 
                  id="confirmed" 
                  disabled={isEventFull && !alreadyConfirmed}
                />
                <Label htmlFor="confirmed" className={isEventFull && !alreadyConfirmed ? "text-muted-foreground cursor-not-allowed" : ""}>
                  Yes, I'll attend
                  {isEventFull && !alreadyConfirmed && <span className="text-xs block">(Event full)</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="declining" id="declining" />
                <Label htmlFor="declining">No, I can't make it</Label>
              </div>
            </RadioGroup>
            {form.formState.errors.status && (
              <p className="text-sm text-destructive">{form.formState.errors.status.message}</p>
            )}
            {state.errors?._form && (
              <p className="text-sm text-destructive">{state.errors._form.join(", ")}</p>
            )}
          </div>
           {isEventFull && !alreadyConfirmed && (
            <Alert variant="default" className="bg-secondary">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Event Capacity Reached</AlertTitle>
              <AlertDescription>
                We're sorry, but the event has reached its maximum capacity. You can still decline the invitation.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton currentStatus={invitation.status} />
        </CardFooter>
      </form>
    </Card>
  );
}
