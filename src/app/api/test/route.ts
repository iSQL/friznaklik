// src/app/api/test/route.ts

console.log('--- Loading /api/test/route.ts ---'); // Debug log at the top

import { NextResponse } from 'next/server';

// Handles GET requests to /api/test
export async function GET() {
  console.log('GET /api/test: Request received'); // Debug log
  return NextResponse.json({ message: 'Test API route is working!' }, { status: 200 });
}
