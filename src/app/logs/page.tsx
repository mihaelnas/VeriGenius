
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ServerCrash, ShieldCheck, ShieldX } from 'lucide-react';
import type { ApiRequestLog } from '@/lib/verigenius-types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function LogsPage() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const firestore = useFirestore();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    const logsCollection = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'request-logs'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: logs, isLoading: isLoadingLogs, error } = useCollection<ApiRequestLog>(logsCollection);

    const formatTimestamp = (isoString: string) => {
        try {
            return format(new Date(isoString), "dd MMM yyyy 'à' HH:mm:ss", { locale: fr });
        } catch {
            return isoString;
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
        <div className="flex flex-col flex-1 p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Logs de l'API</h1>
            </div>

            <Card className="shadow-xl flex-1">
                <CardHeader>
                    <CardTitle>Activité Récente</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[70vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>IP Client</TableHead>
                                    <TableHead>Requête</TableHead>
                                    <TableHead>Réponse</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingLogs ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center p-8">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center p-8 text-destructive">
                                            <ServerCrash className="h-8 w-8 mx-auto mb-2" />
                                            Erreur de chargement des logs.
                                        </TableCell>
                                    </TableRow>
                                ) : logs && logs.length > 0 ? (
                                    logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell>
                                                <Badge variant={log.isSuccess ? 'default' : 'destructive'} className="flex items-center gap-1 w-fit">
                                                    {log.isSuccess ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
                                                    {log.statusCode}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                                            <TableCell>{log.clientIp}</TableCell>
                                            <TableCell>
                                                <pre className="text-xs bg-muted p-2 rounded-md font-mono">{JSON.stringify(log.requestBody, null, 2)}</pre>
                                            </TableCell>
                                            <TableCell>
                                                <pre className="text-xs bg-muted p-2 rounded-md font-mono">{JSON.stringify(log.responseBody, null, 2)}</pre>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center p-8">
                                            Aucun log d'API pour le moment.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
