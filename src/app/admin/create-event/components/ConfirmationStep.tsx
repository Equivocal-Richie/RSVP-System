
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, PartyPopper, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { makeEventPublicServerAction } from '../actions';

interface ConfirmationStepProps {
  eventId: string | null;
}

export function ConfirmationStep({ eventId }: ConfirmationStepProps) {
  const [isPublicDialogOpen, setIsPublicDialogOpen] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isMakingPublic, setIsMakingPublic] = useState(false);
  const { toast } = useToast();

  const handleMakePublic = async () => {
    if (!eventId || !agreeToTerms) return;
    setIsMakingPublic(true);
    try {
      const result = await makeEventPublicServerAction(eventId);
      if (result.success) {
        toast({
          title: "Event Made Public",
          description: `Your event is now public. Link: ${result.publicLink || 'Check dashboard.'}`,
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to make event public.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsMakingPublic(false);
      setIsPublicDialogOpen(false);
      setAgreeToTerms(false); // Reset for next time
    }
  };
  
  if (!eventId) {
    return (
      <Alert variant="destructive">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          There was an issue finalizing your event. Please try again or contact support.
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/admin">Back to Dashboard</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="text-center space-y-6 py-8">
      <PartyPopper className="mx-auto h-16 w-16 text-green-500" />
      <h2 className="text-3xl font-bold">Event Created Successfully!</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Your event (ID: {eventId}) has been created, and invitations are being processed. 
        You can now manage your event from the main dashboard.
      </p>
      
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
        <Button asChild size="lg">
          <Link href="/admin">
            <ExternalLink className="mr-2 h-5 w-5" />
            Go to Admin Dashboard
          </Link>
        </Button>
        
        <Dialog open={isPublicDialogOpen} onOpenChange={setIsPublicDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Eye className="mr-2 h-5 w-5" />
              Make Event Public (Optional)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make Your Event Public?</DialogTitle>
              <DialogDescription>
                Making your event public will allow anyone to find and RSVP to it.
                A general registration link (<code>/rsvp/public/{eventId}</code>) will be activated.
                This action can be managed later from the event settings.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Public events may be listed on the homepage and will have a shareable RSVP link.
                Ensure your event details (especially location if physical) are suitable for a public audience.
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox 
                    id="agree-terms-public" 
                    checked={agreeToTerms} 
                    onCheckedChange={(checked) => setAgreeToTerms(Boolean(checked))} 
                />
                <Label htmlFor="agree-terms-public" className="text-sm font-normal cursor-pointer">
                  I understand and agree to make this event public.
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsPublicDialogOpen(false); setAgreeToTerms(false); }} disabled={isMakingPublic}>
                Cancel
              </Button>
              <Button onClick={handleMakePublic} disabled={!agreeToTerms || isMakingPublic}>
                {isMakingPublic ? "Processing..." : "Accept & Make Public"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

    