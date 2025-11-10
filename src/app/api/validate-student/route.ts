
import { NextRequest, NextResponse } from 'next/server';

// Force la route à être dynamique pour s'assurer qu'elle est exécutée côté serveur à chaque appel
export const dynamic = 'force-dynamic';

/**
 * Route de test pour valider le déploiement sur Vercel.
 * Renvoie une réponse statique pour confirmer que la route est accessible.
 */
export async function POST(request: NextRequest) {
  console.log('Requête de test reçue sur /api/validate-student');

  // Renvoie une réponse simple pour confirmer que l'API est en ligne.
  return NextResponse.json({ message: "API is alive and responding." }, { status: 200 });
}
