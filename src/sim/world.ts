/** Dane świata wbudowane w grę. Powstają raz, skryptem z tools/data, i nie zmieniają się w trakcie rozgrywki. */

export interface Airport {
  /** Kod IATA, trzy litery. Klucz lotniska w całej grze. */
  iata: string;
  /** Kod ICAO, cztery litery. */
  icao: string;
  name: string;
  city: string;
  /** Kod kraju ISO 3166-1 alpha-2. */
  country: string;
  lng: number;
  lat: number;
  /** Wysokość nad poziomem morza w metrach. */
  elevationM: number;
  /** L = duże lotnisko, M = średnie (według OurAirports). */
  size: 'L' | 'M';
  /** Najdłuższy czynny pas w metrach; 0, gdy brak danych. */
  runwayM: number;
  /** Ludzie, którzy mają do lotniska blisko. Liczeni przy każdym lotnisku w zasięgu, więc sąsiednie lotniska się pokrywają. */
  catchRaw: number;
  /** Ludzie przypisani do lotniska bez podwójnego liczenia: sąsiednie lotniska dzielą się nimi. Podstawa popytu. */
  catch: number;
  /** Region NUTS 2 (Eurostat); pusty poza obszarem objętym podziałem. */
  nuts: string;
  /** Zamożność regionu albo kraju; średnia Unii Europejskiej = 100. */
  wealth: number;
  /** Noclegi turystów zagranicznych w okolicy lotniska w kolejnych miesiącach roku, w tysiącach. */
  nights: number[];
  /** true, gdy noclegi są szacunkiem z ludności, a nie danymi Eurostatu. */
  nightsEstimated: boolean;
}

export interface WorldData {
  /** Kiedy zbudowano paczkę. */
  builtAt: string;
  /** Rok, z którego pochodzą statystyki. */
  year: number;
  source: string;
  airports: Airport[];
  /** Powiązania między krajami: ['DE-PL', tysiące obywateli jednego kraju mieszkających w drugim]. */
  ties: [string, number][];
}

/** Prawdziwy ruch pasażerów na trasach (Eurostat), do kalibracji modelu i do porównań w grze. */
export interface RealRoutes {
  year: number;
  source: string;
  /** ['DTM-KTW', pasażerów w roku w obu kierunkach] */
  routes: [string, number][];
}
