import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GraduationCap, ShieldCheck, Database, Code, KeyRound } from 'lucide-react';

const CodeBlock = ({ code }: { code: string }) => (
  <pre className="bg-primary/10 dark:bg-primary/5 p-4 rounded-lg text-sm text-foreground overflow-x-auto border border-primary/20">
    <code>{JSON.stringify(JSON.parse(code), null, 2)}</code>
  </pre>
);

const requestBody = `{
  "studentId": "STU12345",
  "name": "Alice Johnson",
  "level": "Undergraduate",
  "fieldOfStudy": "Computer Science"
}`;

const successResponse = `{
  "success": true,
  "message": "Student validated and enrolled successfully.",
  "studentId": "STU12345",
  "classId": "CS101"
}`;

const errorResponse = `{
  "success": false,
  "error": "Student validation failed. Please check the provided data."
}`;


export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-image');

  const features = [
    {
      icon: <ShieldCheck className="h-8 w-8 text-primary" />,
      title: "Validation des données des étudiants",
      description: "Valide de manière robuste l'identité de l'étudiant et les détails académiques par rapport à la base de données centrale de l'université, garantissant l'intégrité des données."
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-primary" />,
      title: "Attribution automatisée des cours",
      description: "Détermine et attribue intelligemment le cours approprié pour chaque étudiant validé en fonction de son niveau et de son domaine d'études."
    },
    {
      icon: <Database className="h-8 w-8 text-primary" />,
      title: "Intégration n8n & Firestore",
      description: "Met à jour de manière transparente le statut de l'étudiant à 'actif' et les inscrit dans les documents de cours de votre base de données Firestore."
    }
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground">
      <header className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-primary">API VeriGenius</h1>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-12 pb-16 text-center">
          <div className="mb-8">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-primary mb-4">
              Validation transparente des étudiants
            </h2>
            <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground">
              Un point de terminaison d'API sécurisé et fiable pour valider les données des étudiants et automatiser facilement les affectations de cours.
            </p>
          </div>
          {heroImage && (
            <div className="relative mx-auto max-w-5xl h-64 md:h-96 rounded-2xl overflow-hidden shadow-2xl shadow-primary/20">
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/50 to-transparent"></div>
            </div>
          )}
        </section>

        {/* Features Section */}
        <section className="py-16 bg-card">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-background/50 border-0 shadow-lg transition-transform hover:scale-105">
                  <CardHeader className="flex flex-row items-center gap-4">
                    {feature.icon}
                    <CardTitle className="text-xl text-primary">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* API Documentation Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-primary">Démarrage rapide de l'API</h3>
            <p className="mt-2 text-lg text-muted-foreground">Intégrez en quelques minutes avec notre point de terminaison d'API simple.</p>
          </div>

          <Card className="max-w-4xl mx-auto shadow-xl">
            <CardContent className="p-2 md:p-6">
              <Tabs defaultValue="endpoint" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-primary/5">
                  <TabsTrigger value="endpoint"><KeyRound className="mr-2 h-4 w-4" />Point de terminaison</TabsTrigger>
                  <TabsTrigger value="request"><Code className="mr-2 h-4 w-4"/>Requête</TabsTrigger>
                  <TabsTrigger value="success">Succès</TabsTrigger>
                  <TabsTrigger value="error">Erreur</TabsTrigger>
                </TabsList>
                <div className="pt-6">
                  <TabsContent value="endpoint">
                    <h4 className="font-semibold text-lg mb-2 text-primary">POST /api/validate-student</h4>
                    <p className="text-muted-foreground mb-4">
                      Le seul point de terminaison pour toutes les demandes de validation des étudiants. Sécurisez vos demandes en incluant une clé API dans l'en-tête d'autorisation.
                    </p>
                    <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-lg text-sm text-foreground border border-primary/20">
                      <code>Authorization: Bearer VOTRE_CLÉ_API</code>
                    </div>
                  </TabsContent>
                  <TabsContent value="request">
                    <h4 className="font-semibold text-lg mb-2 text-primary">Corps de la requête</h4>
                    <p className="text-muted-foreground mb-4">
                      Fournissez les détails de l'étudiant dans le corps de la requête pour validation.
                    </p>
                    <CodeBlock code={requestBody} />
                  </TabsContent>
                  <TabsContent value="success">
                    <h4 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Réponse de succès (200 OK)</h4>
                    <p className="text-muted-foreground mb-4">
                      En cas de validation réussie, l'API renvoie l'étudiant et l'ID de cours nouvellement attribué.
                    </p>
                    <CodeBlock code={successResponse} />
                  </TabsContent>
                  <TabsContent value="error">
                    <h4 className="font-semibold text-lg mb-2 text-destructive">Réponse d'erreur (4xx/5xx)</h4>
                     <p className="text-muted-foreground mb-4">
                      Si la validation échoue ou qu'une erreur se produit, l'API fournit un message d'erreur clair.
                    </p>
                    <CodeBlock code={errorResponse} />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="bg-card py-6 mt-16">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} API VeriGenius. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
