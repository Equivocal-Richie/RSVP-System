"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEventAnalyticsData, triggerEventAiAnalysis, fetchAndPrepareFeedbackSummary } from '../actions';
import type { EventAnalyticRow, AnalyzeEventPerformanceInput, EventAnalysisOutput } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, ArrowUpCircle, ArrowDownCircle, AlertCircle, Info, Sparkles, Lightbulb, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    setAiAnalysisResult(null); 

    let guestFeedbackSummary: string | undefined = undefined;
    try {
      // Fetch and prepare feedback summary
      guestFeedbackSummary = await fetchAndPrepareFeedbackSummary(eventRow.eventId);
      if (guestFeedbackSummary) {
        toast({ title: "Feedback Loaded", description: "Guest feedback summary prepared for AI analysis.", variant: "default", duration: 2000 });
      }
    } catch (fbError: any) {
      console.error("Failed to fetch or summarize feedback for AI analysis:", fbError);
      toast({ title: "Feedback Fetch Error", description: `Could not load guest feedback: ${fbError.message}`, variant: "default" });
    }

    const analysisInput: AnalyzeEventPerformanceInput = {
      eventId: eventRow.eventId,
      eventName: eventRow.eventName,
      // TODO: Fetch full event details to get a proper description for better analysis
      // For now, the AI flow is designed to handle a placeholder or generic description.
      eventDescription: "Event description would ideally be fetched here. Consider aspects like event goals, target audience, and key activities.", 
      eventDate: eventRow.eventDate,
      confirmedGuests: eventRow.confirmedGuests,
      seatLimit: eventRow.seatLimit,
      capacityFilledPercentage: eventRow.capacityFilledPercentage,
      guestFeedbackSummary: guestFeedbackSummary,
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
            Review metrics for your past events. Use AI to analyze performance, incorporating guest feedback for deeper insights and suggestions.
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
            {aiAnalysisResult.overallSentiment && (
                <div>
                    <h3 className="font-semibold text-lg flex items-center mb-1">Overall Sentiment:</h3>
                    <p className="text-sm text-muted-foreground italic">{aiAnalysisResult.overallSentiment}</p>
                </div>
            )}
            {aiAnalysisResult.insights && aiAnalysisResult.insights.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg flex items-center mt-3 mb-2"><TrendingUp className="mr-2 h-5 w-5 text-primary"/>Key Insights:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {aiAnalysisResult.insights.map((insight, index) => <li key={`insight-${index}`}>{insight}</li>)}
                </ul>
              </div>
            )}
            {aiAnalysisResult.suggestions && aiAnalysisResult.suggestions.length > 0 && (
               <div>
                <h3 className="font-semibold text-lg flex items-center mt-4 mb-2"><Sparkles className="mr-2 h-5 w-5 text-primary"/>Actionable Suggestions:</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {aiAnalysisResult.suggestions.map((suggestion, index) => <li key={`suggestion-${index}`}>{suggestion}</li>)}
                </ul>
              </div>
            )}
             {(!aiAnalysisResult.insights || aiAnalysisResult.insights.length === 0) && (!aiAnalysisResult.suggestions || aiAnalysisResult.suggestions.length === 0) && !aiAnalysisResult.overallSentiment && (
                <p className="text-sm text-muted-foreground">AI analysis did not return specific insights or suggestions for this event. This might be due to limited input data or no guest feedback being available.</p>
             )}
          </CardContent>
        </Card>
      )}
       {isAiAnalyzing && analyzingEventId && (
         <div className="flex justify-center items-center h-32 mt-6">
            <Activity className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">AI is analyzing event data and feedback, please wait...</span>
         </div>
       )}

       <Alert variant="default" className="bg-card border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Understanding The Metrics</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Capacity Filled:</strong> Percentage of available seats filled (if seat limit was set).</li>
                <li><strong>Change vs Prev.:</strong> Difference in 'Capacity Filled %' compared to the event held immediately before this one (if both had seat limits).</li>
                <li><strong>AI Analysis:</strong> Click to get AI-powered insights. The analysis now attempts to incorporate any submitted guest feedback for richer, more contextual suggestions.</li>
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