
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { studentCreationSchema, type Student, SupportedFieldOfStudy, SupportedLevel } from '@/lib/verigenius-types';
import type { z } from 'zod';
import { useEffect } from 'react';

export type StudentFormData = z.infer<typeof studentCreationSchema>;

interface StudentFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: StudentFormData) => void;
  student: (Student & { id: string }) | null;
}

export function StudentForm({ isOpen, onOpenChange, onSubmit, student }: StudentFormProps) {
  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentCreationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      studentId: '',
      level: 'L1',
      fieldOfStudy: 'IG',
      status: 'pending_payment',
      classId: 'L1-IG-G',
    },
  });

  const levelValue = form.watch('level');
  const fieldOfStudyValue = form.watch('fieldOfStudy');
  const classIdValue = form.watch('classId');

  useEffect(() => {
    if (isOpen) {
        if (student) {
            form.reset(student);
        } else {
            // Set default classId when opening for creation
            form.reset({
                firstName: '',
                lastName: '',
                studentId: '',
                level: 'L1',
                fieldOfStudy: 'IG',
                status: 'pending_payment',
                classId: 'L1-IG-G',
            });
        }
    }
  }, [student, form, isOpen]);


  useEffect(() => {
    // This effect runs when level or fieldOfStudy changes
    if (!levelValue || !fieldOfStudyValue) return;

    // Preserve the group part if it exists (e.g., "-G1")
    const groupRegex = /-G\d*$/;
    const existingGroup = groupRegex.exec(classIdValue);
    const groupSuffix = existingGroup ? existingGroup[0] : '-G';

    const newClassId = `${levelValue}-${fieldOfStudyValue}${groupSuffix}`;

    if (newClassId !== classIdValue) {
        form.setValue('classId', newClassId, { shouldValidate: true });
    }
  }, [levelValue, fieldOfStudyValue, form, classIdValue]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{student ? 'Modifier l\'étudiant' : 'Ajouter un étudiant'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Matricule</FormLabel>
                  <FormControl>
                    <Input placeholder="1814 H-F" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fieldOfStudy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filière</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une filière" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SupportedFieldOfStudy.options.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un niveau" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {SupportedLevel.options.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statut</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionter un statut" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending_payment">En attente de paiement</SelectItem>
                      <SelectItem value="partially_paid">Paiement partiel</SelectItem>
                      <SelectItem value="fully_paid">Paiement complet</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID de la Classe</FormLabel>
                  <FormControl>
                    <Input placeholder="L1-IG-G1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
