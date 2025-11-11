
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Edit, Trash2, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StudentForm, StudentFormData } from '@/components/StudentForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import type { Student, StudentValidationPayload } from '@/lib/verigenius-types';
import { useMemoFirebase } from '@/firebase/provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


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
    const firestore = useFirestore();

    // State for the validation test form
    const [validationData, setValidationData] = useState<StudentValidationPayload>({
        studentId: '',
        firstName: '',
        lastName: '',
    });
    const [isValiding, setIsValidating] = useState(false);

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
    
    const handleValidateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsValidating(true);
        console.log("Envoi de la requête vers l'API de validation...", validationData);
        try {
            const response = await fetch('/api/validate-student', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(validationData),
            });
            
            const result = await response.json();
            console.log("Réponse de l'API de validation reçue :", result);

            if (result.success) {
                toast({
                    title: "Validation Réussie",
                    description: `Étudiant ${result.student.firstName} trouvé. Classe: ${result.student.classId}`,
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: "Échec de la validation",
                    description: result.message || "Les informations ne correspondent pas ou l'étudiant est introuvable.",
                });
            }

        } catch (err) {
             toast({
                variant: "destructive",
                title: "Erreur de communication",
                description: "Impossible de contacter l'API de validation.",
            });
        } finally {
            setIsValidating(false);
        }
    }

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
        <div className="flex flex-col flex-1 p-4 md:p-6 space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Tester l'API de Validation</CardTitle>
                    <CardDescription>
                        Entrez les informations d'un étudiant pour tester la réponse de l'API.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleValidateStudent} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="validate-studentId">Matricule</Label>
                                <Input 
                                    id="validate-studentId" 
                                    placeholder="1815 H-F" 
                                    value={validationData.studentId}
                                    onChange={(e) => setValidationData({...validationData, studentId: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="validate-firstName">Prénom</Label>
                                <Input 
                                    id="validate-firstName" 
                                    placeholder="Mihael" 
                                    value={validationData.firstName}
                                    onChange={(e) => setValidationData({...validationData, firstName: e.target.value})}
                                    required
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="validate-lastName">Nom</Label>
                                <Input 
                                    id="validate-lastName" 
                                    placeholder="NAS" 
                                    value={validationData.lastName}
                                    onChange={(e) => setValidationData({...validationData, lastName: e.target.value})}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isValiding}>
                            {isValiding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Valider
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Gestion des Étudiants</h1>
                <Button onClick={openCreateForm}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un étudiant
                </Button>
            </div>
            
            <Card className="shadow-xl flex-1">
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

            <StudentForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                student={selectedStudent}
            />
        </div>
    );
}

    