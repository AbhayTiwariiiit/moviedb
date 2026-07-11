import mockMovies from '../data/movies.json';

const API_KEY = import.meta.env.TMDB_API_KEY || process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

function getImageUrl(path: string | null, size: string = 'w500') {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function mapMovie(tmdbMovie: any) {
  // Try to find mock data for missing fields like platforms/quality if desired, or generate dummy
  return {
    id: tmdbMovie.id.toString(),
    slug: tmdbMovie.id.toString(),
    title: tmdbMovie.title || tmdbMovie.name,
    synopsis: tmdbMovie.overview,
    posterUrl: getImageUrl(tmdbMovie.poster_path),
    backdropUrl: getImageUrl(tmdbMovie.backdrop_path, 'w1280'),
    year: (tmdbMovie.release_date || tmdbMovie.first_air_date || '').substring(0, 4) || 'N/A',
    ratings: {
      imdb: tmdbMovie.vote_average ? parseFloat(tmdbMovie.vote_average.toFixed(1)) : 0,
      rottenTomatoes: Math.floor(tmdbMovie.vote_average * 10) || 0,
      metacritic: Math.floor(tmdbMovie.vote_average * 10) || 0
    },
    quality: ["1080p", "720p"],
    language: [tmdbMovie.original_language?.toUpperCase() || "EN"],
    genres: ["Movie"],
    isTrending: true,
    isFeatured: false,
    boxOffice: {
      budget: 'N/A',
      worldwide: 'N/A'
    },
    runtime: '120',
    releaseDate: tmdbMovie.release_date || tmdbMovie.first_air_date,
    certification: 'PG-13',
    director: 'N/A',
    category: 'hollywood-movies',
    cast: [],
    platforms: ['Netflix', 'Amazon Prime'],
    fileSize: {
      "1080p": "1.5GB",
      "720p": "800MB"
    }
  };
}

export async function fetchFromTMDB(endpoint: string, queryParams: Record<string, string> = {}) {
  if (!API_KEY) {
    console.warn("No TMDB API Key provided. Falling back to mock data.");
    return null;
  }

  const params = new URLSearchParams({
    api_key: API_KEY,
    ...queryParams
  });

  try {
    const response = await fetch(`${BASE_URL}${endpoint}?${params}`);
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("TMDB Fetch Error:", error);
    return null;
  }
}

export async function getTrendingMovies() {
  const data = await fetchFromTMDB('/trending/all/day');
  if (!data || !data.results) return mockMovies.filter(m => m.isTrending);
  return data.results.map(mapMovie);
}

export async function getPopularMovies(page: number = 1) {
  const data = await fetchFromTMDB('/movie/popular', { page: page.toString() });
  if (!data || !data.results) {
    // mock fallback pagination
    return {
      results: mockMovies,
      totalPages: 1,
      totalResults: mockMovies.length
    };
  }
  return {
    results: data.results.map(mapMovie),
    totalPages: Math.min(data.total_pages, 500), // TMDB caps at 500 pages
    totalResults: data.total_results
  };
}

export async function getMovieDetails(id: string) {
  if (!API_KEY) return mockMovies.find(m => m.id === id || m.slug === id) || mockMovies[0];

  const data = await fetchFromTMDB(`/movie/${id}`, { append_to_response: 'credits' });
  if (!data) return mockMovies[0];

  const movie = mapMovie(data);
  movie.runtime = data.runtime?.toString() || '120';
  movie.genres = data.genres?.map((g: any) => g.name) || ["Movie"];
  movie.boxOffice = {
    budget: data.budget ? `$${(data.budget / 1000000).toFixed(1)}M` : 'N/A',
    worldwide: data.revenue ? `$${(data.revenue / 1000000).toFixed(1)}M` : 'N/A'
  };
  
  if (data.credits && data.credits.cast) {
    movie.cast = data.credits.cast.slice(0, 8).map((c: any) => ({
      name: c.name,
      character: c.character,
      profileUrl: getImageUrl(c.profile_path, 'w185')
    })) as any;
    
    const director = data.credits.crew.find((c: any) => c.job === 'Director');
    if (director) movie.director = director.name;
  }

  return movie;
}

export async function searchMovies(query: string, page: number = 1) {
  if (!API_KEY) {
    return {
      results: mockMovies.filter(m => 
        m.title.toLowerCase().includes(query.toLowerCase())
      ),
      totalPages: 1
    };
  }
  
  const data = await fetchFromTMDB('/search/multi', { query, page: page.toString() });
  if (!data) return { results: [], totalPages: 0 };
  
  return {
    results: data.results.filter((r:any) => r.media_type !== 'person').map(mapMovie),
    totalPages: Math.min(data.total_pages, 500)
  };
}

export async function getMoviesByGenre(genreSlug: string, page: number = 1) {
  // TMDB Genre ID mapping
  const genreMap: Record<string, string> = {
    'action': '28',
    'adventure': '12',
    'animation': '16',
    'comedy': '35',
    'crime': '80',
    'documentary': '99',
    'drama': '18',
    'family': '10751',
    'fantasy': '14',
    'history': '36',
    'horror': '27',
    'music': '10402',
    'mystery': '9648',
    'romance': '10749',
    'sci-fi': '878',
    'thriller': '53',
    'war': '10752'
  };

  const genreId = genreMap[genreSlug.toLowerCase()];
  
  if (!API_KEY || !genreId) {
    return { results: [], totalPages: 0, totalResults: 0 };
  }

  const data = await fetchFromTMDB('/discover/movie', {
    with_genres: genreId,
    page: page.toString(),
    sort_by: 'popularity.desc'
  });

  if (!data) return { results: [], totalPages: 0, totalResults: 0 };

  return {
    results: data.results.map(mapMovie),
    totalPages: Math.min(data.total_pages, 500),
    totalResults: data.total_results
  };
}

export async function getMoviesByCategory(categorySlug: string, page: number = 1) {
  if (!API_KEY) return { results: [], totalPages: 0, totalResults: 0 };

  let queryParams: Record<string, string> = {
    page: page.toString(),
    sort_by: 'popularity.desc'
  };

  switch (categorySlug) {
    case 'bollywood-movies':
      queryParams.with_original_language = 'hi';
      queryParams.region = 'IN';
      break;
    case 'hollywood-movies':
      queryParams.with_original_language = 'en';
      break;
    case 'south-hindi-movies':
      queryParams.with_original_language = 'te|ta|ml|kn'; // Telugu, Tamil, Malayalam, Kannada
      queryParams.region = 'IN';
      break;
    case 'web-series':
    case 'tv-shows':
      const tvData = await fetchFromTMDB('/discover/tv', queryParams);
      if (!tvData) return { results: [], totalPages: 0, totalResults: 0 };
      return {
        results: tvData.results.map(mapMovie),
        totalPages: Math.min(tvData.total_pages, 500),
        totalResults: tvData.total_results
      };
    default:
      // Fallback
      break;
  }

  const data = await fetchFromTMDB('/discover/movie', queryParams);
  if (!data) return { results: [], totalPages: 0, totalResults: 0 };

  return {
    results: data.results.map(mapMovie),
    totalPages: Math.min(data.total_pages, 500),
    totalResults: data.total_results
  };
}
