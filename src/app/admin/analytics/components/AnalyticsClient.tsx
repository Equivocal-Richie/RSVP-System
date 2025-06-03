
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEventAnalyticsData, triggerEventAiAnalysis } from '../actions';
import type { EventAnalyticRow, AnalyzeEventPerformanceInput, EventAnalysisOutput } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, ArrowUpCircle, ArrowDownCircle, AlertCircle, Info, Sparkles, Lightbulb, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { getFeedbackForEvent } from '@/lib/db'; // For future use to fetch and summarize feedback

export default function AnalyticsClient() {
  const { user, loading: authLoading } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<EventAnalyticRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<EventAnalysisOutput | null>(null);


  useEffect(() => {
    async function loadAnalytics() {
      if (authLoading) return;
      if (!user) {
        setError("Please sign in to view event analytics.");
        setIsLoading(false);
        setAnalyticsData([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      const result = await fetchEventAnalyticsData(user.uid);

      if (result.error) {
        setError(result.error);
        toast({ title: "Error Loading Analytics", description: result.error, variant: "destructive" });
        setAnalyticsData([]);
      } else {
        setAnalyticsData(result.analytics);
      }
      setIsLoading(false);
    }
    loadAnalytics();
  }, [user, authLoading, toast]);

  const handleAiAnalysis = async (eventRow: EventAnalyticRow) => {
    setAnalyzingEventId(eventRow.eventId);
    setIsAiAnalyzing(true);
    setAiAnalysisResult(null); // Clear previous results

    // In a future step, you would fetch and summarize feedback here:
    // let guestFeedbackSummary: string | undefined = undefined;
    // try {
    //   const feedbackItems = await getFeedbackForEvent(eventRow.eventId); // This DB function needs to exist
    //   if (feedbackItems.length > 0) {
    //      // Basic summarization for now, could be an AI call itself for better summary
    //      guestFeedbackSummary = feedbackItems.map(f => `Rating ${f.rating}/5: ${f.likedMost}. Suggestions: ${f.suggestionsForImprovement || 'None'}`).join('\n---\n');
    //      if (guestFeedbackSummary.length > 1500) guestFeedbackSummary = guestFeedbackSummary.substring(0, 1500) + "... (feedback truncated)";
    //   }
    // } catch (fbError) {
    //   console.error("Failed to fetch or summarize feedback for AI analysis:", fbError);
    //   toast({ title: "Feedback Fetch Error", description: "Could not load guest feedback for full analysis.", variant: "default" });
    // }

    const analysisInput: AnalyzeEventPerformanceInput = {
      eventId: eventRow.eventId,
      eventName: eventRow.eventName,
      eventDescription: "Event description would be fetched or passed here.", // Placeholder - Ideally fetch full event details
      eventDate: eventRow.eventDate,
      confirmedGuests: eventRow.confirmedGuests,
      seatLimit: eventRow.seatLimit,
      capacityFilledPercentage: eventRow.capacityFilledPercentage,
      // guestFeedbackSummary: guestFeedbackSummary, // Pass the summary here
    };

    const result = await triggerEventAiAnalysis(analysisInput);

    if ("error" in result) {
      toast({
        title: "AI Analysis Error",
        description: result.error,
        variant: "destructive",
      });
      setAiAnalysisResult(null);
    } else {
      setAiAnalysisResult(result);
      toast({
        title: "AI Analysis Complete",
        description: `Insights generated for "${eventRow.eventName}".`,
      });
    }
    setIsAiAnalyzing(false);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
     return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!user) {
     return (
      <Alert variant="default" className="max-w-2xl mx-auto bg-card">
        <Info className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>You need to be signed in to view your event analytics.</AlertDescription>
      </Alert>
    );
  }

  if (analyticsData.length === 0 && !isLoading) {
    return (
      <Card className="text-center shadow-lg">
        <CardHeader>
          <CardTitle>No Event Analytics Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Once you have past events, their performance analytics will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-6 w-6 text-primary" />
            Event Performance Analytics
          </CardTitle>
          <CardDescription>
            Review metrics for your past events to understand engagement and success. Use AI for deeper insights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Confirmed</TableHead>
                <TableHead className="text-center">Capacity Filled</TableHead>
                <TableHead className="text-center">Change vs Prev.</TableHead>
                <TableHead className="text-right">AI Analysis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyticsData.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell className="font-medium">{event.eventName}</TableCell>
                  <TableCell>{format(new Date(event.eventDate), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-center">{event.confirmedGuests}</TableCell>
                  <TableCell className="text-center">
                    {event.capacityFilledPercentage !== null
                      ? `${event.capacityFilledPercentage.toFixed(1)}%`
                      : (event.seatLimit <=0 ? 'Unlimited' : 'N/A')}
                     {event.seatLimit > 0 && <span className="text-xs text-muted-foreground block">({event.confirmedGuests}/{event.seatLimit})</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {event.changeFromPreviousPercentage !== null ? (
                      <span className={cn(
                        "flex items-center justify-center font-semibold",
                        event.changeFromPreviousPercentage > 0 && "text-green-600",
                        event.changeFromPreviousPercentage < 0 && "text-red-600"
                      )}>
                        {event.changeFromPreviousPercentage > 0 ? <ArrowUpCircle className="mr-1 h-4 w-4" /> : <ArrowDownCircle className="mr-1 h-4 w-4" />}
                        {event.changeFromPreviousPercentage > 0 ? '+' : ''}
                        {event.changeFromPreviousPercentage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAiAnalysis(event)}
                        disabled={isAiAnalyzing && analyzingEventId === event.eventId}
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {isAiAnalyzing && analyzingEventId === event.eventId ? (
                        <Activity className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
             {analyticsData.length === 0 && (
                <TableCaption>No event analytics data available yet.</TableCaption>
             )}
          </Table>
        </CardContent>
      </Card>

      {analyzingEventId && aiAnalysisResult && !isAiAnalyzing && (
        <Card className="shadow-lg mt-6 animate-fadeIn">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lightbulb className="mr-2 h-6 w-6 text-yellow-500" />
              AI Analysis for: {analyticsData.find(e => e.eventId === analyzingEventId)?.eventName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiAnalysisResult.insights && aiAnalysisResult.insights.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg flex items-center mb-2"><TrendingUp className="mr-2 h-5 w-5 text-primary"/>Insights:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {aiAnalysisResult.insights.map((insight, index) => <li key={`insight-${index}`}>{insight}</li>)}
                </ul>
              </div>
            )}
            {aiAnalysisResult.suggestions && aiAnalysisResult.suggestions.length > 0 && (
               <div>
                <h3 className="font-semibold text-lg flex items-center mt-4 mb-2"><Sparkles className="mr-2 h-5 w-5 text-primary"/>Suggestions:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {aiAnalysisResult.suggestions.map((suggestion, index) => <li key={`suggestion-${index}`}>{suggestion}</li>)}
                </ul>
              </div>
            )}
            {aiAnalysisResult.overallSentiment && (
                <div>
                    <h3 className="font-semibold text-lg flex items-center mt-4 mb-2">Overall Sentiment:</h3>
                    <p className="text-sm text-muted-foreground">{aiAnalysisResult.overallSentiment}</p>
                </div>
            )}
             {(!aiAnalysisResult.insights || aiAnalysisResult.insights.length === 0) && (!aiAnalysisResult.suggestions || aiAnalysisResult.suggestions.length === 0) && (
                <p className="text-sm text-muted-foreground">AI analysis did not return specific insights or suggestions for this event.</p>
             )}
          </CardContent>
        </Card>
      )}
       {isAiAnalyzing && analyzingEventId && (
         <div className="flex justify-center items-center h-32 mt-6">
            <Activity className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">AI is analyzing, please wait...</span>
         </div>
       )}

       <Alert variant="default" className="bg-card border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Understanding The Metrics</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Capacity Filled:</strong> Percentage of available seats filled (if seat limit was set).</li>
                <li><strong>Change vs Prev.:</strong> Difference in 'Capacity Filled %' compared to the event held immediately before this one (if both had seat limits).</li>
                <li><strong>AI Analysis:</strong> Click to get AI-powered insights and suggestions for a specific event. (Note: Guest feedback analysis is a future enhancement that will provide richer insights).</li>
            </ul>
          </AlertDescription>
        </Alert>

        <style jsx global>{`
            .animate-fadeIn {
            animation: fadeIn 0.5s ease-out;
            }
            @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
            }
        `}</style>
    </div>
  );
}
