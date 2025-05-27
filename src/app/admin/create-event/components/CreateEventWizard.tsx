
"use client";

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EventDetailsStep } from './EventDetailsStep';
import { GuestListStep } from './GuestListStep';
import { PreviewSendStep } from './PreviewSendStep';
import { ConfirmationStep } from './ConfirmationStep';
import type { EventData, GuestInput, EventMood } from '@/types';
import { createEventAndProcessInvitations, type CreateEventAndInvitationsInput } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_EVENT_NAME_LENGTH = 70;

// Define the object shape for event details (client-side schema)
const eventDetailsObjectSchema = z.object({
  name: z.string().min(3, "Event name is too short").max(MAX_EVENT_NAME_LENGTH, `Event name is too long (max ${MAX_EVENT_NAME_LENGTH} chars)`),
  description: z.string().min(10, "Description is too short"),
  date: z.date({ required_error: "Event date is required." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  location: z.string().min(3, "Location is too short"),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed'], { required_error: "Please select an event mood." }),
  hasSeatLimit: z.enum(['yes', 'no']),
  seatLimitNumber: z.number().optional().default(0), // Renamed from seatLimit to avoid conflict with server schema expectation
  eventImage: z.custom<File>((val) => val instanceof File, "Please upload an event image.").optional(),
  organizerEmail: z.string().email("Please enter a valid organizer email for inquiries.").optional().or(z.literal("")),
});

// Define the object shape for guest list
const guestListObjectSchema = z.object({
  guests: z.array(z.object({
    name: z.string().min(2, "Guest name is too short"),
    email: z.string().email("Invalid guest email address"),
  })).min(1, "Please add at least one guest."),
});

// Merge the ZodObject schemas
const combinedObjectSchema = eventDetailsObjectSchema.merge(guestListObjectSchema);

// Apply refinements to the combined schema
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
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const { toast } = useToast();

  const methods = useForm<CreateEventFormData>({
    resolver: zodResolver(wizardSchema),
    mode: 'onChange', 
    defaultValues: {
      name: "",
      description: "",
      // date: undefined, // Let date picker handle initial undefined state
      time: "18:00",
      location: "",
      mood: 'casual',
      hasSeatLimit: 'no',
      seatLimitNumber: 0,
      guests: [{ name: "", email: "" }],
      organizerEmail: "",
    },
  });

  const { handleSubmit, trigger, getValues } = methods;

  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 1) {
      isValid = await trigger(Object.keys(eventDetailsObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 2) {
      isValid = await trigger(Object.keys(guestListObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 3) {
      isValid = true; 
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

  const onSubmit = async (data: CreateEventFormData) => {
    setIsLoading(true);
    try {
      // Prepare data for the server action
      const serverInput: CreateEventAndInvitationsInput = {
        eventData: {
          name: data.name,
          description: data.description,
          date: data.date.toISOString(), // Convert Date to ISO string
          time: data.time,
          location: data.location,
          mood: data.mood as EventMood,
          seatLimit: data.hasSeatLimit === 'yes' ? (data.seatLimitNumber || 0) : -1,
          organizerEmail: data.organizerEmail || undefined,
          isPublic: false, // Default, can be changed later
          // eventImagePath: data.eventImage ? await handleImageUpload(data.eventImage) : undefined, // Future: handle image upload
        },
        guests: data.guests,
      };
      
      const result = await createEventAndProcessInvitations(serverInput);

      if (result.success && result.eventId) {
        setCreatedEventId(result.eventId);
        setCurrentStep(totalSteps); 
        toast({
          title: "Event Created Successfully!",
          description: "Invitations are being processed.",
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

  return (
    <FormProvider {...methods}>
      <Card className="w-full max-w-3xl mx-auto shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary">Create New Event (Step {currentStep} of {totalSteps})</CardTitle>
          <Progress value={progressValue} className="w-full mt-2 h-3" />
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
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
             {currentStep === totalSteps && ( // No buttons on confirmation step or a "Go to Dashboard" button
              <div className="ml-auto"></div> // Placeholder to keep footer structure if needed
            )}
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}
