import { NextRequest, NextResponse } from 'next/server';

const NETEASE_API_LOCAL = 'http://127.0.0.1:3002';

// Load cookies from environment (same as netease-user/liked)
const COOKIES = {
  MUSIC_A_T: process.env.MUSIC_A_T || '',
  MUSIC_R_T: process.env.MUSIC_R_T || '',
  MUSIC_R_U: process.env.MUSIC_R_U || '',
  MUSIC_U: process.env.MUSIC_U || '',
  NMTID: process.env.NMTID || '',
  __csrf: process.env.__csrf || '',
};

function buildCookieHeader(): string {
  return Object.entries(COOKIES)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return new NextResponse('id required', { status: 400 });
  }

  try {
    const cookieStr = buildCookieHeader();
    console.error('[netease-play] cookies:', cookieStr ? 'present' : 'EMPTY');
    const url = `${NETEASE_API_LOCAL}/song/url?id=${id}`;
    const response = await fetch(url, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0',
      },
    });
    const data = await response.json();

    if (data.data && data.data.length > 0 && data.data[0].url) {
      const audioUrl = data.data[0].url;
      // Redirect to the actual audio URL
      return NextResponse.redirect(audioUrl, 302);
    }

    return new NextResponse('Audio not found', { status: 404 });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
