import { NextRequest, NextResponse } from 'next/server';

const NETEASE_API_LOCAL = 'http://127.0.0.1:3002';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
};
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const url = `${NETEASE_API_LOCAL}/song/detail?ids=${id}`;
    const response = await fetch(url, { next: { revalidate: 0 } });
    const data = await response.json();

    if (data.songs && data.songs.length > 0) {
      const song = data.songs[0];
      const artistNames = (song.ar || []).map((a: any) => a.name).filter(Boolean).join(', ');
      const albumName = song.al?.name || song.album?.name || '';
      const coverUrl = song.al?.picUrl || song.album?.picUrl || '';
      return NextResponse.json({
        id: song.id.toString(),
        title: song.name,
        artist: artistNames,
        album: albumName,
        coverUrl: coverUrl,
        duration: song.dt || song.duration || 0,
        isNetease: true,
        neteaseId: song.id.toString(),
      }, { headers: { ...corsHeaders, ...noCacheHeaders } });
    }

    return NextResponse.json({ error: 'song not found' }, { status: 404, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
