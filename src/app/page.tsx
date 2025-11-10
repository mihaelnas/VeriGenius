
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, UserPlus, Edit, Trash2, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StudentForm, StudentFormData } from '@/components/StudentForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/verigenius-types';
import { useMemoFirebase } from '@/firebase/provider';


// Helper function to capitalize the first letter of each word
const capitalize = (str: string) => {
    if (!str) return '';
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

export default function Home() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<(Student & { id: string }) | null>(null);
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const auth = useAuth();
    const firestore = useFirestore();

    // Redirection si l'utilisateur n'est pas connecté
    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    const studentsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'students');
    }, [firestore]);

    const { data: students, isLoading: isLoadingData, error } = useCollection<Student>(studentsCollection);
    
    useEffect(() => {
        if (error) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible de charger la liste des étudiants.",
            });
            console.error(error);
        }
    }, [error, toast]);


    const handleFormSubmit = async (data: StudentFormData) => {
        if (!firestore) return;

        // Apply formatting before sending
        const formattedData = {
            ...data,
            firstName: capitalize(data.firstName),
            lastName: data.lastName.toUpperCase(),
        };

        try {
             if (selectedStudent) {
                // Update existing student
                const studentDoc = doc(firestore, 'students', selectedStudent.id);
                await updateDoc(studentDoc, formattedData);
                toast({
                    title: "Succès",
                    description: "Étudiant mis à jour avec succès.",
                });
            } else {
                // Add new student
                await addDoc(collection(firestore, 'students'), formattedData);
                toast({
                    title: "Succès",
                    description: "Étudiant ajouté avec succès.",
                });
            }
            setIsFormOpen(false);
        } catch (error: any) {
            console.error("Error submitting form: ", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message || "Une erreur est survenue.",
            });
        }
    };

    const handleDeleteStudent = async (studentId: string) => {
        if (!firestore) return;
        try {
            const studentDoc = doc(firestore, 'students', studentId);
            await deleteDoc(studentDoc);
            toast({
                title: "Succès",
                description: "Étudiant supprimé avec succès.",
            });
        } catch (error: any) {
            console.error("Error deleting student: ", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message || "Une erreur est survenue lors de la suppression.",
            });
        }
    };
    
    const handleLogout = async () => {
        if(auth) {
            await auth.signOut();
        }
        router.push('/login');
    };

    const openCreateForm = () => {
        setSelectedStudent(null);
        setIsFormOpen(true);
    };

    const openEditForm = (student: Student & { id: string }) => {
        setSelectedStudent(student);
        setIsFormOpen(true);
    };

    const getStatusVariant = (status: Student['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
        switch (status) {
            case 'fully_paid':
                return 'default'; // Greenish in some themes
            case 'partially_paid':
                return 'secondary'; // Bluish/Yellowish
            case 'pending_payment':
                return 'outline'; // Greyish
            case 'inactive':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    const getStatusText = (status: Student['status']): string => {
        switch (status) {
            case 'fully_paid':
                return 'Paiement complet';
            case 'partially_paid':
                return 'Paiement partiel';
            case 'pending_payment':
                return 'En attente de paiement';
            case 'inactive':
                return 'Inactif';
            default:
                return status;
        }
    }
    
    if (isUserLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-dvh bg-background text-foreground">
            <header className="container mx-auto px-4 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <UserPlus className="h-7 w-7 text-primary" />
                    <h1 className="text-2xl font-bold text-primary">Gestion des Étudiants</h1>
                </div>
                 <div className="flex items-center gap-4">
                    <Button onClick={openCreateForm}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un étudiant
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" className="flex items-center gap-2">
                                {user.email}
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                                <LogOut className="mr-2 h-4 w-4" />
                                Déconnexion
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-4">
                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle>Liste des étudiants</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nom complet</TableHead>
                                    <TableHead>Matricule</TableHead>
                                    <TableHead>Filière</TableHead>
                                    <TableHead>Niveau</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingData ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">
                                            <div className="flex justify-center items-center p-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : students && students.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">Aucun étudiant trouvé.</TableCell>
                                    </TableRow>
                                ) : (
                                    students && students.map((student) => (
                                        <TableRow key={student.id}>
                                            <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                                            <TableCell>{student.studentId}</TableCell>
                                            <TableCell>{student.fieldOfStudy}</TableCell>
                                            <TableCell>{student.level}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(student.status)}>
                                                    {getStatusText(student.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Ouvrir le menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => openEditForm(student)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Modifier
                                                            </DropdownMenuItem>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                     <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Cette action est irréversible. Cela supprimera définitivement l'étudiant.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteStudent(student.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Supprimer
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>

            <StudentForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                student={selectedStudent}
            />

            <footer className="bg-card py-6 mt-16">
                <div className="container mx-auto px-4 text-center text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} API VeriGenius. Tous droits réservés.</p>
                </div>
            </footer>
        </div>
    );
}

    