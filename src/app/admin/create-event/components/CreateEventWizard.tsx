
"use client";

import { useState, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EventDetailsStep } from './EventDetailsStep';
import { GuestListStep } from './GuestListStep';
import { PreviewSendStep } from './PreviewSendStep';
import { ConfirmationStep } from './ConfirmationStep';
import type { GuestInput, EventMood } from '@/types';
import { createEventAndProcessInvitations } from '../actions'; 
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const MAX_EVENT_NAME_LENGTH = 70;

// Base object schemas
const eventDetailsObjectSchema = z.object({
  name: z.string().min(3, "Event name is too short").max(MAX_EVENT_NAME_LENGTH, `Event name is too long (max ${MAX_EVENT_NAME_LENGTH} chars)`),
  description: z.string().min(10, "Description is too short"),
  date: z.date({ required_error: "Event date is required." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  location: z.string().min(3, "Location is too short"),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed'], { required_error: "Please select an event mood." }),
  hasSeatLimit: z.enum(['yes', 'no']),
  seatLimitNumber: z.number().optional().default(0),
  eventImage: z.custom<File>((val) => val instanceof File, "Please upload an event image.").optional(),
  organizerEmail: z.string().email("Please enter a valid organizer email for inquiries.").optional().or(z.literal("")),
});

const guestListObjectSchema = z.object({
  guests: z.array(z.object({
    name: z.string().min(2, "Guest name is too short"),
    email: z.string().email("Invalid guest email address"),
  })).min(1, "Please add at least one guest."),
});

// Merged schema before refinement
const combinedObjectSchema = eventDetailsObjectSchema.merge(guestListObjectSchema);

// Apply refinement to the merged schema
const wizardSchema = combinedObjectSchema.refine(data => {
  if (data.hasSeatLimit === 'yes') {
    return data.seatLimitNumber != null && data.seatLimitNumber > 0;
  }
  return true;
}, {
  message: "Seat limit must be a positive number if enabled.",
  path: ["seatLimitNumber"],
});

export type CreateEventFormData = z.infer<typeof wizardSchema>;

const totalSteps = 4;

export function CreateEventWizard() {
  const { user, loading: authLoading } = useAuth(); 
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);


  const methods = useForm<CreateEventFormData>({
    resolver: zodResolver(wizardSchema),
    mode: 'onChange', 
    defaultValues: {
      name: "",
      description: "",
      // date: undefined, // Let calendar default handle it or set explicitly if needed
      time: "18:00",
      location: "",
      mood: 'casual',
      hasSeatLimit: 'no',
      seatLimitNumber: 0,
      guests: [{ name: "", email: "" }],
      organizerEmail: "",
    },
  });

  const { trigger, getValues, control } = methods; 

  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 1) {
      isValid = await trigger(Object.keys(eventDetailsObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 2) {
      isValid = await trigger(Object.keys(guestListObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 3) {
      isValid = true; // Preview step, validation done on previous steps
    }
    
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else if (!isValid) {
        toast({
            title: "Validation Error",
            description: "Please correct the errors on the form before proceeding.",
            variant: "destructive",
        });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const processFormSubmission = async (data: CreateEventFormData) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to create an event.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append("creatorId", user.uid); 
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("date", data.date.toISOString());
    formData.append("time", data.time);
    formData.append("location", data.location);
    formData.append("mood", data.mood);
    
    formData.append("seatLimit", data.hasSeatLimit === 'yes' ? (data.seatLimitNumber || 0).toString() : "-1");
    if (data.organizerEmail) {
      formData.append("organizerEmail", data.organizerEmail);
    }
    if (data.eventImage) {
      formData.append("eventImage", data.eventImage);
    }
    formData.append("guests", JSON.stringify(data.guests));

    try {
      const result = await createEventAndProcessInvitations(formData);

      if (result.success && result.eventId) {
        setCreatedEventId(result.eventId);
        setCurrentStep(totalSteps); 
        toast({
          title: "Event Created Successfully!",
          description: result.message || "Invitations are being processed.",
        });
      } else {
        toast({
          title: "Error Creating Event",
          description: result.message || "An unknown error occurred.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Event creation error:", error);
      toast({
        title: "Submission Error",
        description: "An unexpected error occurred while creating the event.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const progressValue = (currentStep / totalSteps) * 100;

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><p>Loading authentication state...</p></div>;
  }

  if (!user) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10 shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Authentication Required</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You must be logged in to create an event. Please 
              <Link href="/auth" className="underline text-primary hover:text-primary/80 ml-1">sign in or sign up</Link>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <FormProvider {...methods}>
      {/* Removed max-w-3xl and mx-auto from Card to allow it to expand */}
      <Card className="w-full shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary">Create New Event (Step {currentStep} of {totalSteps})</CardTitle>
          <Progress value={progressValue} className="w-full mt-2 h-3" />
        </CardHeader>
        <form ref={formRef} onSubmit={methods.handleSubmit(processFormSubmission)} noValidate>
          <CardContent className="min-h-[400px] py-6">
            {currentStep === 1 && <EventDetailsStep />}
            {currentStep === 2 && <GuestListStep />}
            {currentStep === 3 && <PreviewSendStep eventData={getValues()} guestList={getValues().guests} />}
            {currentStep === 4 && <ConfirmationStep eventId={createdEventId} />}
          </CardContent>
          <CardFooter className="flex justify-between pt-6 border-t">
            {currentStep > 1 && currentStep < totalSteps && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                Back
              </Button>
            )}
             {currentStep === 1 && <div />} {/* Placeholder to align Next button to the right */}
            {currentStep < 3 && (
              <Button type="button" onClick={handleNext} disabled={isLoading} className="ml-auto">
                Next
              </Button>
            )}
            {currentStep === 3 && (
              <Button type="submit" disabled={isLoading} className="ml-auto">
                {isLoading ? "Processing..." : "Create Event & Prepare Invitations"}
              </Button>
            )}
             {currentStep === totalSteps && ( 
                <div className="ml-auto"></div> 
             )}
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}

    