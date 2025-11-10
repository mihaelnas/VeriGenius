
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, UserX, UserPlus, Edit, Trash2, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StudentForm, StudentFormData } from '@/components/StudentForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/verigenius-types';

export default function Home() {
    const [students, setStudents] = useState<(Student & { id: string })[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<(Student & { id: string }) | null>(null);
    const { toast } = useToast();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const auth = useAuth();

    // Redirection si l'utilisateur n'est pas connecté
    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    async function fetchStudents() {
        if (!user) return;
        setIsLoadingData(true);
        try {
            const response = await fetch('/api/students');
            if (!response.ok) throw new Error('Failed to fetch students');
            const data = await response.json();
            setStudents(data);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible de charger la liste des étudiants.",
            });
        } finally {
            setIsLoadingData(false);
        }
    }

    useEffect(() => {
        if (user) {
            fetchStudents();
        }
    }, [user]);

    const handleFormSubmit = async (data: StudentFormData) => {
        const method = selectedStudent ? 'PUT' : 'POST';
        const url = selectedStudent ? `/api/students/${selectedStudent.id}` : '/api/students';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Une erreur est survenue.');
            }

            toast({
                title: "Succès",
                description: `Étudiant ${selectedStudent ? 'mis à jour' : 'ajouté'} avec succès.`,
            });
            setIsFormOpen(false);
            fetchStudents(); // Refresh the list
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message,
            });
        }
    };

    const handleDeleteStudent = async (studentId: string) => {
        try {
            const response = await fetch(`/api/students/${studentId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Une erreur est survenue.');
            }

            toast({
                title: "Succès",
                description: "Étudiant supprimé avec succès.",
            });
            fetchStudents(); // Refresh the list
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: error.message,
            });
        }
    };
    
    const handleLogout = async () => {
        await auth.signOut();
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

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'active':
                return 'default';
            case 'inactive':
                return 'secondary';
            case 'pending':
                return 'outline';
            default:
                return 'secondary';
        }
    };
    
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
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingData ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">
                                            <div className="flex justify-center items-center p-8">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : students.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">Aucun étudiant trouvé.</TableCell>
                                    </TableRow>
                                ) : (
                                    students.map((student) => (
                                        <TableRow key={student.id}>
                                            <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                                            <TableCell>{student.studentId}</TableCell>
                                            <TableCell>{student.fieldOfStudy}</TableCell>
                                            <TableCell>{student.level}</TableCell>
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
