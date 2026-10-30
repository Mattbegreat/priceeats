import { NextResponse } from 'next/server';
import { createRepository } from '@/repositories';
import { handleMenuSubmission } from '@/server/handlers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid', message: '需要 JSON 內容' }, { status: 400 });
  }
  const r = await handleMenuSubmission(body, createRepository());
  return NextResponse.json(r.body, { status: r.status });
}
