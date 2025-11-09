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
      title: "Student Data Validation",
      description: "Robustly validates student identity and academic details against the university's central database, ensuring data integrity."
    },
    {
      icon: <GraduationCap className="h-8 w-8 text-primary" />,
      title: "Automated Class Assignment",
      description: "Intelligently determines and assigns the correct class for each validated student based on their level and field of study."
    },
    {
      icon: <Database className="h-8 w-8 text-primary" />,
      title: "n8n & Firestore Integration",
      description: "Seamlessly updates student status to 'active' and enrolls them into class documents within your Firestore database."
    }
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground">
      <header className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-primary">VeriGenius API</h1>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-12 pb-16 text-center">
          <div className="mb-8">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-primary mb-4">
              Seamless Student Validation
            </h2>
            <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground">
              A secure, reliable API endpoint for validating student data and automating class assignments with ease.
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
            <h3 className="text-3xl md:text-4xl font-bold text-primary">API Quickstart</h3>
            <p className="mt-2 text-lg text-muted-foreground">Integrate in minutes with our straightforward API endpoint.</p>
          </div>

          <Card className="max-w-4xl mx-auto shadow-xl">
            <CardContent className="p-2 md:p-6">
              <Tabs defaultValue="endpoint" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-primary/5">
                  <TabsTrigger value="endpoint"><KeyRound className="mr-2 h-4 w-4" />Endpoint</TabsTrigger>
                  <TabsTrigger value="request"><Code className="mr-2 h-4 w-4"/>Request</TabsTrigger>
                  <TabsTrigger value="success">Success</TabsTrigger>
                  <TabsTrigger value="error">Error</TabsTrigger>
                </TabsList>
                <div className="pt-6">
                  <TabsContent value="endpoint">
                    <h4 className="font-semibold text-lg mb-2 text-primary">POST /api/validate-student</h4>
                    <p className="text-muted-foreground mb-4">
                      The single endpoint for all student validation requests. Secure your requests by including an API key in the Authorization header.
                    </p>
                    <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-lg text-sm text-foreground border border-primary/20">
                      <code>Authorization: Bearer YOUR_API_KEY</code>
                    </div>
                  </TabsContent>
                  <TabsContent value="request">
                    <h4 className="font-semibold text-lg mb-2 text-primary">Request Body</h4>
                    <p className="text-muted-foreground mb-4">
                      Provide the student's details in the request body for validation.
                    </p>
                    <CodeBlock code={requestBody} />
                  </TabsContent>
                  <TabsContent value="success">
                    <h4 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Success Response (200 OK)</h4>
                    <p className="text-muted-foreground mb-4">
                      On successful validation, the API returns the student and newly assigned class ID.
                    </p>
                    <CodeBlock code={successResponse} />
                  </TabsContent>
                  <TabsContent value="error">
                    <h4 className="font-semibold text-lg mb-2 text-destructive">Error Response (4xx/5xx)</h4>
                     <p className="text-muted-foreground mb-4">
                      If validation fails or an error occurs, the API provides a clear error message.
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
          <p>&copy; {new Date().getFullYear()} VeriGenius API. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
