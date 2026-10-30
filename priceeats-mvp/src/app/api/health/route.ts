import { NextResponse } from 'next/server';
import { createRepository } from '@/repositories';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, repository: createRepository().kind });
}
