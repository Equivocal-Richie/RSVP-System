
"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mail, Info, Sparkles, RefreshCw, MailWarning, Layers } from 'lucide-react';
import type { CreateEventFormData } from './CreateEventWizard';
import { generatePersonalizedInvitationText, type GenerateInvitationTextClientInput, type GenerateInvitationTextClientOutput } from '../actions';
import type { GuestInput, EventMood } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PreviewSendStepProps {
  eventData: Partial<CreateEventFormData>; 
  guestList: GuestInput[];
}
const BREVO_DAILY_LIMIT = 300; 

export function PreviewSendStep({ eventData, guestList }: PreviewSendStepProps) {
  const [sampleEmail, setSampleEmail] = useState<GenerateInvitationTextClientOutput | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentInstructions, setAdjustmentInstructions] = useState("");
  const { toast } = useToast();

  const firstGuest = guestList?.[0];

  const fetchSampleEmail = async (instructions?: string) => {
    if (!firstGuest || !eventData.name || !eventData.description || !eventData.mood) {
      setPreviewError("Not enough event or guest data to generate a preview.");
      setSampleEmail(null);
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const inputForAI: GenerateInvitationTextClientInput = {
        eventName: eventData.name,
        eventDescription: eventData.description,
        eventMood: eventData.mood as EventMood, 
        guestName: firstGuest.name,
        adjustmentInstructions: instructions,
        emailType: 'initialInvitation' 
      };
      const result = await generatePersonalizedInvitationText(inputForAI);

      if (result.success) {
        setSampleEmail(result);
        if (instructions) {
          toast({ title: "Preview Updated", description: "Email preview regenerated with your adjustments." });
        }
      } else {
        setPreviewError(result.message || "Failed to generate email preview.");
        setSampleEmail(null);
        toast({ title: "Preview Error", description: result.message || "Failed to generate email preview.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error generating email preview:", error);
      setPreviewError("An unexpected error occurred while generating the preview.");
      setSampleEmail(null);
      toast({ title: "Preview Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
      setIsAdjustDialogOpen(false); 
    }
  };

  useEffect(() => {
    fetchSampleEmail(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventData.name, eventData.description, eventData.mood, firstGuest?.name]); 

  const handleAdjustSubmit = () => {
    fetchSampleEmail(adjustmentInstructions);
  };

  const eventDate = eventData.date ? new Date(eventData.date).toLocaleDateString() : 'N/A';
  const eventTime = eventData.time || 'N/A';
  const eventLocation = eventData.location || 'N/A';

  return (
    <div className="space-y-6">
      <Alert>
        <Layers className="h-4 w-4" />
        <AlertTitle>Review & Queue Invitations</AlertTitle>
        <AlertDescription>
          You're about to create the event and queue invitations for <strong>{guestList.length}</strong> guest(s).
          Emails will be processed in the background. Below is a sample of the invitation email content for the first guest.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Mail className="mr-2 h-5 w-5 text-primary" />Sample Invitation Email</CardTitle>
          <CardDescription>
            For: {firstGuest?.name || 'Sample Guest'} ({firstGuest?.email || 'guest@example.com'})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-md bg-muted/30 min-h-[250px] whitespace-pre-wrap text-sm overflow-y-auto">
            {isLoadingPreview && <p className="text-muted-foreground">Generating preview...</p>}
            {previewError && <p className="text-destructive">{previewError}</p>}
            {sampleEmail?.success && sampleEmail.emailText && !isLoadingPreview && !previewError && (
              <>
                <p><strong>Subject:</strong> You're Invited to {eventData.name || 'Our Event'}!</p>
                <hr className="my-2"/>
                <p>{sampleEmail.greeting}</p>
                <br />
                <p>{sampleEmail.body}</p>
                <br />
                <p>{sampleEmail.closing}</p>
                <hr className="my-2 mt-4"/>
                <p className="font-semibold">Event Details (for context, actual details included in final email):</p>
                <p><strong>What:</strong> {eventData.name || 'Our Event'}</p>
                <p><strong>When:</strong> {eventDate} at {eventTime}</p>
                <p><strong>Where:</strong> {eventLocation}</p>
                <p className="mt-2 text-xs">To RSVP, guests will click their unique link: [Unique RSVP Link Will Be Here]</p>
                <p className="text-xs">We look forward to seeing you!</p>
              </>
            )}
             {!sampleEmail && !isLoadingPreview && !previewError && !firstGuest && (
                <p className="text-muted-foreground">Add guests in the previous step to see a preview.</p>
             )}
             {!sampleEmail?.success && !isLoadingPreview && !previewError && firstGuest && !sampleEmail?.message && (
                 <p className="text-muted-foreground">Could not generate preview. Ensure all event details are filled.</p>
             )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => fetchSampleEmail()} disabled={isLoadingPreview || !firstGuest}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingPreview && !adjustmentInstructions ? 'animate-spin' : ''}`} />
              Regenerate Preview
            </Button>
            
            <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" disabled={isLoadingPreview || !firstGuest}>
                  <Sparkles className="mr-2 h-4 w-4" /> Adjust with AI
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Email Content</DialogTitle>
                  <DialogDescription>
                    Provide instructions for the AI to refine the invitation text. 
                    For example, "Make it more formal," or "Emphasize the networking opportunities."
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                  <Label htmlFor="adjustment-instructions">Your Instructions:</Label>
                  <Textarea 
                    id="adjustment-instructions"
                    value={adjustmentInstructions}
                    onChange={(e) => setAdjustmentInstructions(e.target.value)}
                    placeholder="e.g., Make the tone more celebratory and mention the keynote speaker, Dr. Jane Doe."
                    rows={4}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsAdjustDialogOpen(false)} disabled={isLoadingPreview}>Cancel</Button>
                  <Button onClick={handleAdjustSubmit} disabled={isLoadingPreview || !adjustmentInstructions.trim()}>
                     {isLoadingPreview && adjustmentInstructions ? (<RefreshCw className="mr-2 h-4 w-4 animate-spin" />) : null}
                    Apply Adjustments & Regenerate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
      <Alert variant="destructive">
        <MailWarning className="h-4 w-4" />
        <AlertTitle>Important: Email Queueing & Sending Limits</AlertTitle>
        <AlertDescription>
          Clicking "Create Event & Queue Invitations" will finalize event details, create unique RSVP links, and add invitation emails to a processing queue.
          Actual sending occurs in the background. Please be aware of daily sending limits (e.g., Brevo free tier: {BREVO_DAILY_LIMIT} emails/day). For large guest lists, a robust queueing system and appropriate email plan are essential for production.
        </AlertDescription>
      </Alert>
    </div>
  );
}

    