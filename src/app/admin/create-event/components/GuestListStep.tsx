
"use client";

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import type { GuestInput } from '@/types';
import { ChangeEvent } from 'react';

export function GuestListStep() {
  const { control, register, setValue, getValues, formState: { errors } } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "guests",
  });
  const { toast } = useToast();

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse<GuestInput>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedGuests = results.data.filter(g => g.name && g.email).map(g => ({ name: g.name.trim(), email: g.email.trim().toLowerCase() }));
          if (parsedGuests.length > 0) {
            const currentGuests = getValues("guests") || [];
            // Filter out duplicates based on email before adding
            const newGuests = parsedGuests.filter(pg => !currentGuests.some((cg: GuestInput) => cg.email === pg.email));
            setValue("guests", [...currentGuests, ...newGuests], { shouldValidate: true });
            toast({ title: "Guests Imported", description: `${newGuests.length} new guests added from CSV.` });
          } else {
            toast({ title: "Import Issue", description: "No valid guests (with name and email) found in CSV or all guests are duplicates.", variant: "destructive" });
          }
        },
        error: (error) => {
          console.error("CSV parsing error:", error);
          toast({ title: "CSV Parsing Error", description: error.message, variant: "destructive" });
        }
      });
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Import Guests from CSV</Label>
        <div className="mt-1 flex items-center">
          <label htmlFor="csv-upload" className="cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md text-sm inline-flex items-center">
            <UploadCloud className="mr-2 h-4 w-4" /> Choose CSV File
          </label>
          <input id="csv-upload" type="file" accept=".csv" className="sr-only" onChange={handleFileUpload} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">CSV file must have 'name' and 'email' columns.</p>
      </div>

      <div className="space-y-2">
        <Label>Manually Add Guests</Label>
        {fields.length > 0 && (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[50px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fields.map((field, index) => (
                    <TableRow key={field.id}>
                        <TableCell>
                        <Input {...register(`guests.${index}.name`)} placeholder="Guest Name" />
                        {errors.guests?.[index]?.name && <p className="text-sm text-destructive">{(errors.guests[index].name as any).message}</p>}
                        </TableCell>
                        <TableCell>
                        <Input {...register(`guests.${index}.email`)} type="email" placeholder="guest@example.com" />
                        {errors.guests?.[index]?.email && <p className="text-sm text-destructive">{(errors.guests[index].email as any).message}</p>}
                        </TableCell>
                        <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1 && index === 0}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        )}
        <Button type="button" variant="outline" onClick={() => append({ name: "", email: "" })} className="mt-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Guest
        </Button>
        {errors.guests && typeof errors.guests === 'object' && !Array.isArray(errors.guests) && <p className="text-sm text-destructive">{(errors.guests as any).message}</p>}

      </div>
    </div>
  );
}
