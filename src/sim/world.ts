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
}

export interface WorldData {
  /** Kiedy i z czego zbudowano paczkę. */
  builtAt: string;
  source: string;
  airports: Airport[];
}
