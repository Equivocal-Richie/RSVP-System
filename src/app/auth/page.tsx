
import { Suspense } from 'react';
import AuthForm from './components/AuthForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LockKeyhole } from 'lucide-react';

export const metadata = {
  title: "Sign In / Sign Up - RSVP Now",
  description: "Access your event dashboard or create a new account.",
};

export default function AuthenticationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-15rem)] py-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <LockKeyhole className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl">Event Organizer Access</CardTitle>
          <CardDescription>Sign in to manage your events or create a new account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-center"><p>Loading form...</p></div>}>
            <AuthForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
