import movies from '../../data/movies.json';

export async function GET() {
  return new Response(JSON.stringify(movies), {
    headers: { 'Content-Type': 'application/json' },
  });
}
