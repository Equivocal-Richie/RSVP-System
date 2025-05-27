
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
import { createEventAndProcessInvitations } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_EVENT_NAME_LENGTH = 70;

// Define the object shape for event details
const eventDetailsObjectSchema = z.object({
  name: z.string().min(3, "Event name is too short").max(MAX_EVENT_NAME_LENGTH, `Event name is too long (max ${MAX_EVENT_NAME_LENGTH} chars)`),
  description: z.string().min(10, "Description is too short"),
  date: z.date({ required_error: "Event date is required." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  location: z.string().min(3, "Location is too short"),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed'], { required_error: "Please select an event mood." }),
  hasSeatLimit: z.enum(['yes', 'no']),
  seatLimit: z.number().optional().default(0),
  eventImage: z.custom<File>((val) => val instanceof File, "Please upload an event image.").optional(),
  organizerEmail: z.string().email("Please enter a valid organizer email for inquiries.").optional(),
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
    // Ensure seatLimit is a positive number if hasSeatLimit is 'yes'
    return data.seatLimit != null && data.seatLimit > 0;
  }
  return true;
}, {
  message: "Seat limit must be a positive number if enabled.",
  path: ["seatLimit"], // Path relative to the combined data object
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
      seatLimit: 0,
      guests: [{ name: "", email: "" }],
      organizerEmail: "",
    },
  });

  const { handleSubmit, trigger, getValues } = methods;

  const handleNext = async () => {
    let isValid = false;
    if (currentStep === 1) {
      // Trigger validation for fields in the eventDetailsObjectSchema part
      isValid = await trigger(Object.keys(eventDetailsObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 2) {
      // Trigger validation for fields in the guestListObjectSchema part
      isValid = await trigger(Object.keys(guestListObjectSchema.shape) as Array<keyof CreateEventFormData>);
    } else if (currentStep === 3) {
      isValid = true; // Preview step, no new validation, assumes previous steps are valid
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
      const eventToCreate: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt' | 'eventImagePath'> = {
        name: data.name,
        description: data.description,
        date: data.date.toISOString(),
        time: data.time,
        location: data.location,
        mood: data.mood as EventMood,
        seatLimit: data.hasSeatLimit === 'yes' ? (data.seatLimit || 0) : -1, // -1 for unlimited
        organizerEmail: data.organizerEmail || undefined,
        isPublic: false, // Default to private
      };
      
      // TODO: Handle eventImage upload and get eventImagePath

      const guestsToInvite: GuestInput[] = data.guests;

      const result = await createEventAndProcessInvitations({ eventData: eventToCreate, guests: guestsToInvite });

      if (result.success && result.eventId) {
        setCreatedEventId(result.eventId);
        setCurrentStep(totalSteps); // Go to Done step
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
          <CardContent className="min-h-[400px]">
            {currentStep === 1 && <EventDetailsStep />}
            {currentStep === 2 && <GuestListStep />}
            {currentStep === 3 && <PreviewSendStep eventData={getValues()} guestList={getValues().guests} />}
            {currentStep === 4 && <ConfirmationStep eventId={createdEventId} />}
          </CardContent>
          <CardFooter className="flex justify-between pt-6">
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
                {isLoading ? "Processing..." : "Create Event & Send Invitations"}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}
