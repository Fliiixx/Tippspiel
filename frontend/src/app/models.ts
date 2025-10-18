export interface Tipp {
  name: string;
  zahl: number;
  abweichung: number;
  punkte: number;
  platz: number;
}


export interface Runde {
  gewinnzahl: number;
  tipps: Tipp[];
  saison?: number;
  rundenNummer?: number;
}


export interface Spieler {
  name: string;
  gesamtpunkte: number;
  gesamtabweichung: number;
}


export interface PersistedData {
  runden: Runde[];
  rangliste: Spieler[];
}

// Neue Interfaces für Backend-Responses
export interface SaisonInfo {
  saison: number;
}

export interface RundeResponse {
  runde: number;
  gewinnzahl: number;
  saison?: number;
}

export interface RanglisteEintrag {
  name: string;
  gesamtpunkte: number;
}

export interface TippResponse {
  id: number;
  name: string;
  zahl: number;
  abweichung: number;
  punkte: number;
  platz: number;
  runde: number;
  gewinnzahl: number;
  saison: number;
}
