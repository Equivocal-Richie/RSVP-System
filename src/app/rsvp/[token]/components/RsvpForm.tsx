
"use client";

import React, { useEffect, useState, useTransition } from "react"; // Added useTransition
import { useActionState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { submitRsvp, type RsvpFormState } from "../actions";
import { submitPublicRsvp } from "../../public/[token]/actions";
import { useToast } from "@/hooks/use-toast";
import type { InvitationData, EventData, RsvpStatus } from "@/types";
import { AlertCircle, PartyPopper, UserX, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";


const RsvpFormSchemaClient = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  status: z.enum(["confirmed", "declining"]).optional(),
});

type RsvpFormValues = z.infer<typeof RsvpFormSchemaClient>;

interface RsvpFormProps {
  invitation: InvitationData | {
    id: string;
    uniqueToken: string;
    eventId: string;
    guestName: string;
    guestEmail: string;
    status: RsvpStatus;
    visited: boolean;
    createdAt?: string;
    updatedAt?: string;
  };
  event: EventData;
  isPublicRsvp?: boolean;
}

function SubmitButton({ currentStatus, isPublicRsvp, isSubmitting }: { currentStatus?: RsvpStatus, isPublicRsvp?: boolean, isSubmitting: boolean }) {
  let buttonText = "Submit RSVP";
  if (isPublicRsvp) {
    buttonText = "Reserve My Spot";
  } else if (currentStatus && currentStatus !== 'pending' && currentStatus !== 'waitlisted') {
    buttonText = "Update RSVP";
  }

  return (
    <Button type="submit" disabled={isSubmitting} className="w-full">
      {isSubmitting ? "Submitting..." : buttonText}
    </Button>
  );
}

export default function RsvpFormComponent({ invitation, event, isPublicRsvp = false }: RsvpFormProps) {
  const { toast } = useToast();
  const [formSubmittedSuccessfully, setFormSubmittedSuccessfully] = useState(false);
  const [finalRsvpStatus, setFinalRsvpStatus] = useState<RsvpStatus | null>(null);
  const [isSubmitting, startTransition] = useTransition(); // For managing pending state of the manual action call

  const chosenFormAction = isPublicRsvp ? submitPublicRsvp : submitRsvp;
  const initialState: RsvpFormState = { message: "", success: false };
  const [state, formAction] = useActionState(chosenFormAction, initialState);

  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(RsvpFormSchemaClient),
    defaultValues: {
      name: invitation?.guestName || "",
      email: invitation?.guestEmail || "",
      status: (invitation?.status === 'confirmed' || invitation?.status === 'declining') ? invitation.status : undefined,
    },
  });

  const isEventEffectivelyFull = event.seatLimit > 0 && event.confirmedGuestsCount >= event.seatLimit;
  const alreadyConfirmed = invitation?.status === 'confirmed';

  useEffect(() => {
    if (state.message && !isSubmitting) { // Process state only after transition is done
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
          description: state.message || "Submission failed.",
          variant: "destructive",
        });
        if (state.errors?.name) form.setError("name", { type: "server", message: state.errors.name.join(", ") });
        if (state.errors?.email) form.setError("email", { type: "server", message: state.errors.email.join(", ") });
        if (state.errors?.status) form.setError("status", { type: "server", message: state.errors.status.join(", ") });
      }
    }
  }, [state, toast, form, isSubmitting]); // Added isSubmitting to dependencies

  if (formSubmittedSuccessfully || (!isPublicRsvp && (invitation?.status === 'confirmed' || invitation?.status === 'declining') && !form.formState.isDirty && !state.message && !state.errors)) {
    const currentDisplayStatus = finalRsvpStatus || invitation?.status;
    return (
      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="flex items-center">
                {currentDisplayStatus === 'confirmed' ? <PartyPopper className="mr-2 h-6 w-6 text-green-500" /> : <UserX className="mr-2 h-6 w-6 text-red-500" />}
                {currentDisplayStatus === 'confirmed' ? "You're Confirmed!" : "RSVP Recorded"}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <AlertDescription>
            {currentDisplayStatus === 'confirmed'
                ? `Thank you, ${form.getValues().name || 'Guest'}! We've recorded your RSVP as confirmed. We look forward to seeing you at ${event.name}.`
                : `Thank you, ${form.getValues().name || 'Guest'}. We've recorded your RSVP as declining for ${event.name}.`}
            {(currentDisplayStatus === 'waitlisted') && `You have been added to the waitlist for ${event.name}. We will notify you if a spot becomes available.`}

            {!isPublicRsvp && <p className="mt-2 text-xs">You can update your RSVP on this page if your plans change, subject to availability.</p>}
            {isPublicRsvp && currentDisplayStatus === 'confirmed' && <p className="mt-2 text-xs">A confirmation email might be sent (feature pending). Please note down the event details.</p>}
            </AlertDescription>
        </CardContent>
        {!isPublicRsvp && (
          <CardFooter>
              <Button onClick={() => {
              setFormSubmittedSuccessfully(false);
              state.message = "";
              state.success = false;
              state.errors = undefined;
              state.updatedInvitation = undefined;
              form.reset({
                  name: invitation?.guestName || "",
                  email: invitation?.guestEmail || "",
                  status: (invitation?.status === 'confirmed' || invitation?.status === 'declining') ? invitation.status : undefined,
              });
              }} className="mt-4 w-full">
                  Change RSVP
              </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  const handleValidatedSubmit = (clientData: RsvpFormValues) => {
    const formData = new FormData();
    formData.append('name', clientData.name);
    formData.append('email', clientData.email);

    if (!isPublicRsvp) {
      if (!clientData.status) {
        // This should ideally be caught by client-side validation (e.g. making status required in Zod for private)
        // For robustness, handle it here too or ensure Zod schema is stricter for private RSVPs.
        form.setError("status", {type: "manual", message: "Please select your attendance status."});
        return;
      }
      formData.append('status', clientData.status);
      formData.append('token', invitation.uniqueToken);
    } else {
      formData.append('eventId', event.id);
    }

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle>RSVP for {event.name}</CardTitle>
        <CardDescription>
          {isPublicRsvp ? "Please provide your details to reserve a spot." : "Please confirm your attendance below."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(handleValidatedSubmit)}>
        <CardContent className="space-y-6">

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Your full name"
              className={form.formState.errors.name ? "border-destructive" : ""}
              readOnly={!isPublicRsvp && !!invitation?.guestName && invitation.status !== 'pending' && invitation.status !== 'waitlisted'}
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
              readOnly={!isPublicRsvp && !!invitation?.guestEmail && invitation.status !== 'pending' && invitation.status !== 'waitlisted'}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          {!isPublicRsvp && (
            <div className="space-y-2">
              <Label>Will you attend?</Label>
              <RadioGroup
                onValueChange={(value) => form.setValue("status", value as "confirmed" | "declining", { shouldValidate: true })}
                defaultValue={(invitation?.status === 'confirmed' || invitation?.status === 'declining') ? invitation.status : undefined}
                className="flex space-x-4"
                // {...form.register("status")} // register is implicitly handled by setValue and Zod schema
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="confirmed"
                    id="confirmed"
                    disabled={isEventEffectivelyFull && !alreadyConfirmed}
                    checked={form.watch("status") === "confirmed"} // Control checked state
                    onClick={() => form.setValue("status", "confirmed", {shouldValidate: true})}
                  />
                  <Label htmlFor="confirmed" className={cn("cursor-pointer", isEventEffectivelyFull && !alreadyConfirmed ? "text-muted-foreground cursor-not-allowed" : "")}>
                    Yes, I&apos;ll attend
                    {isEventEffectivelyFull && !alreadyConfirmed && <span className="text-xs block">(Event full)</span>}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="declining" id="declining"
                    checked={form.watch("status") === "declining"} // Control checked state
                    onClick={() => form.setValue("status", "declining", {shouldValidate: true})}
                  />
                  <Label htmlFor="declining" className="cursor-pointer">No, I can&apos;t make it</Label>
                </div>
              </RadioGroup>
              {form.formState.errors.status && (
                <p className="text-sm text-destructive">{form.formState.errors.status.message}</p>
              )}
               {/* Ensure status is required for private RSVPs */}
              { !form.getValues().status && form.formState.isSubmitted && !isPublicRsvp && (
                <p className="text-sm text-destructive">Please select your attendance status.</p>
              )}
            </div>
          )}
          {state.errors?._form && (
            <p className="text-sm text-destructive">{state.errors._form.join(", ")}</p>
          )}
           {isEventEffectivelyFull && !alreadyConfirmed && !isPublicRsvp && (
            <Alert variant="default" className="bg-secondary">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Event Capacity Reached</AlertTitle>
              <AlertDescription>
                We&apos;re sorry, but the event has reached its maximum capacity for new confirmations. You can still decline the invitation if you have one.
              </AlertDescription>
            </Alert>
          )}
           {isEventEffectivelyFull && isPublicRsvp && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Event Currently Full</AlertTitle>
              <AlertDescription>
                We're sorry, but this event has reached its maximum capacity and cannot accept new reservations at this time.
              </AlertDescription>
            </Alert>
           )}
        </CardContent>
        <CardFooter>
          <SubmitButton currentStatus={invitation?.status} isPublicRsvp={isPublicRsvp} isSubmitting={isSubmitting} />
        </CardFooter>
      </form>
    </Card>
  );
}

