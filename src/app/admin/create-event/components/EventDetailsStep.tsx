
"use client";

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarIcon, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useState, ChangeEvent } from 'react';
import Image from 'next/image';
import type { EventMood } from '@/types';

const moodOptions: { value: EventMood; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'celebratory', label: 'Celebratory' },
  { value: 'professional', label: 'Professional' },
  { value: 'themed', label: 'Themed' },
];

const MAX_EVENT_NAME_LENGTH = 70;


export function EventDetailsStep() {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext();
  const [eventImagePreview, setEventImagePreview] = useState<string | null>(null);

  const hasSeatLimit = watch('hasSeatLimit');
  const eventName = watch('name', '');


  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue('eventImage', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setEventImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setValue('eventImage', undefined);
      setEventImagePreview(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="name">Event Name</Label>
        <Input id="name" {...register("name")} placeholder="e.g., Annual Company Gala" />
        <p className="text-xs text-muted-foreground mt-1">{eventName.length}/{MAX_EVENT_NAME_LENGTH} characters</p>
        {errors.name && <p className="text-sm text-destructive">{(errors.name as any).message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Event Description</Label>
        <Textarea id="description" {...register("description")} placeholder="Describe your event..." rows={4} />
        {errors.description && <p className="text-sm text-destructive">{(errors.description as any).message}</p>}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="date">Event Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !watch("date") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {watch("date") ? format(watch("date"), "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={watch("date")}
                onSelect={(date) => setValue("date", date, { shouldValidate: true })}
                initialFocus
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
              />
            </PopoverContent>
          </Popover>
          {errors.date && <p className="text-sm text-destructive">{(errors.date as any).message}</p>}
        </div>
        <div>
          <Label htmlFor="time">Event Time</Label>
          <Input id="time" type="time" {...register("time")} />
          {errors.time && <p className="text-sm text-destructive">{(errors.time as any).message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="location">Event Location</Label>
        <Input id="location" {...register("location")} placeholder="e.g., Grand Ballroom, Online" />
        {errors.location && <p className="text-sm text-destructive">{(errors.location as any).message}</p>}
      </div>

      <div>
        <Label htmlFor="mood">Event Mood</Label>
        <Select onValueChange={(value) => setValue('mood', value, { shouldValidate: true })} defaultValue={watch('mood')}>
          <SelectTrigger>
            <SelectValue placeholder="Select event mood" />
          </SelectTrigger>
          <SelectContent>
            {moodOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.mood && <p className="text-sm text-destructive">{(errors.mood as any).message}</p>}
      </div>
      
      <div>
        <Label htmlFor="organizerEmail">Organizer Contact Email (for Inquiries)</Label>
        <Input id="organizerEmail" type="email" {...register("organizerEmail")} placeholder="e.g., events@example.com" />
        {errors.organizerEmail && <p className="text-sm text-destructive">{(errors.organizerEmail as any).message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Are there Seat Limits?</Label>
        <RadioGroup
          defaultValue={watch("hasSeatLimit")}
          onValueChange={(value) => setValue('hasSeatLimit', value, { shouldValidate: true })}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="no-limit" />
            <Label htmlFor="no-limit">No (Unlimited Seats)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="yes-limit" />
            <Label htmlFor="yes-limit">Yes</Label>
          </div>
        </RadioGroup>
        {hasSeatLimit === 'yes' && (
          <div className="mt-2">
            <Label htmlFor="seatLimitNumber">Number of Seats</Label>
            <Input id="seatLimitNumber" type="number" {...register("seatLimitNumber", { valueAsNumber: true, validate: v => (v != null && v > 0) || "Seats must be positive" })} placeholder="e.g., 100" />
            {errors.seatLimitNumber && <p className="text-sm text-destructive">{(errors.seatLimitNumber as any).message}</p>}
          </div>
        )}
      </div>
      
      <div>
        <Label htmlFor="eventImage">Event Picture (Optional)</Label>
        <div className="mt-1 flex items-center space-x-4">
            <label htmlFor="eventImage-input" className="cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm inline-flex items-center">
                <ImageIcon className="mr-2 h-4 w-4"/> Choose File
            </label>
            <input id="eventImage-input" type="file" accept="image/png, image/jpeg, image/webp" className="sr-only" onChange={handleImageChange} />
            {watch("eventImage") && <span className="text-sm text-muted-foreground">{(watch("eventImage") as File).name}</span>}
        </div>
        {eventImagePreview && (
          <div className="mt-4 w-full aspect-video max-h-60 relative rounded-md overflow-hidden border">
            <Image src={eventImagePreview} alt="Event image preview" layout="fill" objectFit="contain" />
          </div>
        )}
        {errors.eventImage && <p className="text-sm text-destructive mt-1">{(errors.eventImage as any).message}</p>}
      </div>

    </div>
  );
}
