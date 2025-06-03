
"use client";

import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { saveEventFeedback, type FeedbackFormState } from "../actions";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Star, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const FeedbackFormSchemaClient = z.object({
  rating: z.coerce.number().min(1, "Rating is required.").max(5, "Rating cannot exceed 5."),
  likedMost: z.string().min(10, "Please provide at least 10 characters for what you liked.").max(1000, "Limit is 1000 characters."),
  suggestionsForImprovement: z.string().max(1000, "Limit is 1000 characters.").optional().default(""),
});

type FeedbackFormValues = z.infer<typeof FeedbackFormSchemaClient>;

interface FeedbackFormProps {
  invitationToken: string;
}

export default function FeedbackFormComponent({ invitationToken }: FeedbackFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmittedSuccessfully, setFormSubmittedSuccessfully] = useState(false);

  const initialState: FeedbackFormState = { message: "", success: false };
  const [state, formAction] = useActionState(saveEventFeedback, initialState);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackFormSchemaClient),
    defaultValues: {
      rating: 0,
      likedMost: "",
      suggestionsForImprovement: "",
    },
  });

  useEffect(() => {
    if (state.message && !isSubmitting) { // Check isSubmitting to avoid toast on initial render if state has old message
      if (state.success) {
        toast({
          title: "Feedback Submitted!",
          description: state.message,
          variant: "default",
        });
        setFormSubmittedSuccessfully(true);
      } else {
        toast({
          title: "Submission Error",
          description: state.message || "Could not submit feedback.",
          variant: "destructive",
        });
        // Map Zod issues to form errors if available
        state.errors?.forEach(issue => {
          const path = issue.path.join(".") as keyof FeedbackFormValues;
          if (path in form.getValues()) { // Check if path is a valid form field name
            form.setError(path, { type: "server", message: issue.message });
          }
        });
      }
    }
    if (!state.success && isSubmitting) setIsSubmitting(false); // Reset submitting state on server error
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]); // Removed form, toast from deps to prevent re-triggering on their instance change

  const onSubmit = async (data: FeedbackFormValues) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("invitationToken", invitationToken);
    formData.append("rating", String(data.rating));
    formData.append("likedMost", data.likedMost);
    formData.append("suggestionsForImprovement", data.suggestionsForImprovement || "");
    
    formAction(formData); 
    // setIsSubmitting will be handled by useEffect based on state.success
  };
  
  useEffect(() => {
    if (state.success) {
      setIsSubmitting(false);
    }
  }, [state.success]);


  if (formSubmittedSuccessfully) {
    return (
      <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-900/30">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-700 dark:text-green-300">Thank You!</AlertTitle>
        <AlertDescription className="text-green-600 dark:text-green-400">
          Your feedback has been successfully submitted. We appreciate you taking the time!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {state.message && !state.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="rating" className="text-lg font-semibold">Overall Rating</Label>
        <RadioGroup
          onValueChange={(value) => form.setValue("rating", parseInt(value), { shouldValidate: true })}
          defaultValue={String(form.watch("rating"))}
          className="flex justify-center space-x-2 sm:space-x-4 pt-2"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <div key={value} className="flex flex-col items-center space-y-1">
              <RadioGroupItem
                value={String(value)}
                id={`rating-${value}`}
                className="sr-only peer" // Visually hide radio, use label for click
              />
              <Label
                htmlFor={`rating-${value}`}
                className={cn(
                  "cursor-pointer rounded-full p-2 transition-colors duration-200 ease-in-out",
                  "hover:bg-accent hover:text-accent-foreground",
                  form.watch("rating") === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Star className={cn("h-6 w-6 sm:h-8 sm:w-8 transition-transform", form.watch("rating") === value ? "fill-current scale-110" : "fill-transparent stroke-current")} />
              </Label>
              <span className={cn("text-xs sm:text-sm font-medium", form.watch("rating") === value ? "text-primary" : "text-muted-foreground")}>{value}</span>
            </div>
          ))}
        </RadioGroup>
        {form.formState.errors.rating && (
          <p className="text-sm text-destructive text-center pt-1">{form.formState.errors.rating.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="likedMost" className="text-lg font-semibold">What did you like most about the event?</Label>
        <Textarea
          id="likedMost"
          {...form.register("likedMost")}
          placeholder="e.g., The keynote speaker, networking opportunities, the venue..."
          rows={4}
          className={form.formState.errors.likedMost ? "border-destructive" : ""}
        />
        {form.formState.errors.likedMost && (
          <p className="text-sm text-destructive">{form.formState.errors.likedMost.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="suggestionsForImprovement" className="text-lg font-semibold">Suggestions for Improvement (Optional)</Label>
        <Textarea
          id="suggestionsForImprovement"
          {...form.register("suggestionsForImprovement")}
          placeholder="e.g., More vegetarian food options, better signage..."
          rows={4}
          className={form.formState.errors.suggestionsForImprovement ? "border-destructive" : ""}
        />
        {form.formState.errors.suggestionsForImprovement && (
          <p className="text-sm text-destructive">{form.formState.errors.suggestionsForImprovement.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : <><Send className="mr-2 h-4 w-4" /> Submit Feedback</>}
      </Button>
    </form>
  );
}
