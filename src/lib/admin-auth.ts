import { NextResponse } from 'next/server';

/**
 * Server-side guard pre /api/admin/* routes.
 *
 * Overi `Authorization: Bearer <ADMIN_PASSWORD>` proti env premennej ADMIN_PASSWORD.
 * Vracia NextResponse (401/500) ked auth zlyha, alebo null ked je OK — vtedy route
 * pokracuje. Vzor prebrany z povodnej promises/route.ts (jedina co auth mala),
 * zjednoteny pre vsetky admin routes.
 *
 * Pouzitie na zaciatku kazdej admin GET/POST:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 *
 * Fail-closed: ak ADMIN_PASSWORD nie je nastavene v prostredi, ODMIETNE vsetko
 * (nikdy nepovoli pristup s prazdnym heslom).
 */
export function requireAdmin(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { success: false, error: 'Server: ADMIN_PASSWORD nie je nakonfigurovane' },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
