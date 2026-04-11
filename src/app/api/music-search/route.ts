import { NextRequest, NextResponse } from 'next/server';

const KUYOU_API_LOCAL = 'http://127.0.0.1:3001';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};
const KUYOU_API_PUBLIC = 'https://kugou-api.fangc.cc';
const ZM_API = 'https://zm.wwoyun.cn';
const QQ_API = 'https://api.uomg.com/api/song.search';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const engine = searchParams.get('engine'); // 'kugou' | 'netease' | 'qq'
  const keyword = searchParams.get('keyword');
  const limit = searchParams.get('limit') || '20';

  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400, headers: corsHeaders });
  }

  try {
    let url: string;
    let response: Response;

    if (engine === 'kugou') {
      // Use local port to avoid SSL certificate issues
      url = `${KUYOU_API_LOCAL}/search?keyword=${encodeURIComponent(keyword)}&pagesize=${limit}`;
      response = await fetch(url, { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 }
      });
    } else if (engine === 'netease') {
      url = `${ZM_API}/cloudsearch?keywords=${encodeURIComponent(keyword)}&limit=${limit}`;
      response = await fetch(url, { next: { revalidate: 0 } });
    } else if (engine === 'qq') {
      url = `${QQ_API}?name=${encodeURIComponent(keyword)}&pagesize=${limit}`;
      response = await fetch(url, { next: { revalidate: 0 } });
    } else {
      return NextResponse.json({ error: 'unknown engine' }, { status: 400, headers: corsHeaders });
    }

    const text = await response.text();
    
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { headers: corsHeaders });
    } catch {
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
