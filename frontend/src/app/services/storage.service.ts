import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PersistedData } from '../models';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove, child } from 'firebase/database';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private http = inject(HttpClient);
  private db: any;
  private aktuelleGilde: string = 'default'; // Standard-Gilde

  // Firebase Konfiguration (aus Firebase Console)
  private firebaseConfig = {
    apiKey: "AIzaSyB9ylZzGGq0SPnSKzopBreMGd8Hj9j31O4",
    authDomain: "tippspiel-fd04d.firebaseapp.com",
    databaseURL: "https://tippspiel-fd04d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tippspiel-fd04d",
    storageBucket: "tippspiel-fd04d.firebasestorage.app",
    messagingSenderId: "832947273917",
    appId: "1:832947273917:web:c3b854a969d4e5b400f7d4"
  };

  constructor() {
    // Firebase initialisieren
    const app = initializeApp(this.firebaseConfig);
    this.db = getDatabase(app);

    // Gilde aus localStorage laden, sonst 'default' verwenden
    const gespeicherteGilde = localStorage.getItem('aktuelleGilde');
    if (gespeicherteGilde) {
      this.aktuelleGilde = gespeicherteGilde;
    }
  }

  // === Gilden-Verwaltung ===
  setAktuelleGilde(gildeName: string): void {
    this.aktuelleGilde = gildeName;
    localStorage.setItem('aktuelleGilde', gildeName);
  }

  getAktuelleGilde(): string {
    return this.aktuelleGilde;
  }

  // Alle Gilden abrufen
  getAlleGilden(): Observable<string[]> {
    return from(
      get(ref(this.db, 'gilden')).then((snapshot) => {
        if (snapshot.exists()) {
          const gildenNamen = Object.keys(snapshot.val());
          return gildenNamen.sort();
        }
        return [];
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Gilden:', error);
        return [];
      })
    );
  }

  // === Saison-Berechnung ===
  private getAktuelleSaisonNumber(): number {
    const startDatum = new Date('2025-07-31').getTime();
    const jetzt = new Date().getTime();
    const diffMs = jetzt - startDatum;
    const diffWochen = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    return Math.floor(diffWochen / 12) + 1;
  }

  // Aktuelle Saison abrufen
  getAktuelleSaison(): Observable<{ saison: number }> {
    return of({ saison: this.getAktuelleSaisonNumber() });
  }

  // Erste verfügbare Saison mit Daten abrufen (oder aktuelle als Fallback)
  getErsterVerfuegbareSaison(): Observable<number> {
    return new Observable(observer => {
      this.getAlleSaisons().subscribe({
        next: (saisons) => {
          if (saisons.length > 0) {
            observer.next(Math.min(...saisons));
          } else {
            observer.next(this.getAktuelleSaisonNumber());
          }
          observer.complete();
        },
        error: (err) => {
          observer.next(this.getAktuelleSaisonNumber());
          observer.complete();
        }
      });
    });
  }

  getAktuellsteVerfuegbareSaison(): Observable<number> {
    return new Observable(observer => {
      this.getAlleSaisons().subscribe({
        next: (saisons) => {
          if (saisons.length > 0) {
            observer.next(Math.max(...saisons));
          } else {
            observer.next(this.getAktuelleSaisonNumber());
          }
          observer.complete();
        },
        error: (err) => {
          observer.next(this.getAktuelleSaisonNumber());
          observer.complete();
        }
      });
    });
  }

  // Alle Saisons abrufen für aktuelle Gilde
  getAlleSaisons(): Observable<number[]> {
    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons`)).then((snapshot) => {
        if (snapshot.exists()) {
          const saisons = Object.keys(snapshot.val()).map(Number);
          let x = (saisons.sort((a, b) => b - a))
          return x;
        }
        return [];
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Saisons:', error);
        return [];
      })
    );
  }

  // Rangliste abrufen (aktuelle oder spezifische Saison) für aktuelle Gilde
  getRangliste(saison?: number): Observable<any[]> {
    const saisonNum = saison || this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden`)).then((snapshot) => {
        if (!snapshot.exists()) {
          return [];
        }

        const runden = snapshot.val();
        const rangliste: { [key: string]: any } = {};

        // Aggregiere Punkte pro Spieler
        Object.values(runden).forEach((runde: any) => {
          Object.values(runde.tipps || {}).forEach((tipp: any) => {
            if (!rangliste[tipp.name]) {
              rangliste[tipp.name] = {
                name: tipp.name,
                gesamtpunkte: 0,
                gesamtabweichung: 0
              };
            }
            rangliste[tipp.name].gesamtpunkte += tipp.punkte || 0;
            rangliste[tipp.name].gesamtabweichung += tipp.abweichung || 0;
          });
        });

        return Object.values(rangliste)
          .sort((a, b) => b.gesamtpunkte - a.gesamtpunkte || a.gesamtabweichung - b.gesamtabweichung);
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Rangliste:', error);
        return [];
      })
    );
  }

  // Rangliste bis zu einer bestimmten Runde berechnen für aktuelle Gilde
  getRanglisteBisRunde(bisRunde: number, saison?: number): Observable<any[]> {
    const saisonNum = saison || this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden`)).then((snapshot) => {
        if (!snapshot.exists()) {
          return [];
        }

        const runden = snapshot.val();
        const rangliste: { [key: string]: any } = {};

        // Aggregiere Punkte pro Spieler nur bis zur angegebenen Runde
        Object.entries(runden).forEach(([rundeNum, runde]: [string, any]) => {
          if (parseInt(rundeNum) <= bisRunde) {
            Object.values(runde.tipps || {}).forEach((tipp: any) => {
              if (!rangliste[tipp.name]) {
                rangliste[tipp.name] = {
                  name: tipp.name,
                  gesamtpunkte: 0,
                  gesamtabweichung: 0
                };
              }
              rangliste[tipp.name].gesamtpunkte += tipp.punkte || 0;
              rangliste[tipp.name].gesamtabweichung += tipp.abweichung || 0;
            });
          }
        });

        return Object.values(rangliste)
          .sort((a, b) => b.gesamtpunkte - a.gesamtpunkte || a.gesamtabweichung - b.gesamtabweichung);
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Rangliste:', error);
        return [];
      })
    );
  }

  // Runden abrufen (aktuelle oder spezifische Saison) für aktuelle Gilde
  getRunden(saison?: number): Observable<any[]> {
    const saisonNum = saison || this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden`)).then((snapshot) => {
        if (!snapshot.exists()) {
          return [];
        }

        const runden = snapshot.val();
        return Object.entries(runden).map(([rundeNum, rundeData]: [string, any]) => ({
          runde: parseInt(rundeNum),
          gewinnzahl: rundeData.gewinnzahl
        })).sort((a, b) => b.runde - a.runde);
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Runden:', error);
        return [];
      })
    );
  }

  // Einzelne Runde abrufen für aktuelle Gilde
  getRunde(rundeId: number, saisonNum: number): Observable<any[]> {
    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden/${rundeId}`)).then((snapshot) => {
        if (!snapshot.exists()) {
          return [];
        }

        const rundeData = snapshot.val();
        return Object.values(rundeData.tipps || {});
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Runde:', error);
        return [];
      })
    );
  }

  // Runde speichern für aktuelle Gilde
  speichereRunde(gewinnzahl: number, tipps: any[]): Observable<any> {
    const saisonNum = this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden`)).then((snapshot) => {
        const runden = snapshot.val() || {};
        const neueRunde = Math.max(...Object.keys(runden).map(Number), 0) + 1;

        const rundenData: { gewinnzahl: number; tipps: { [key: number]: any } } = {
          gewinnzahl,
          tipps: {}
        };

        tipps.forEach((tipp, index) => {
          rundenData.tipps[index] = tipp;
        });

        return set(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden/${neueRunde}`), rundenData)
          .then(() => ({
            runde: neueRunde,
            saison: saisonNum,
            count: tipps.length,
            gilde: this.aktuelleGilde
          }));
      }).catch((error) => {
        console.error('Fehler beim Speichern der Runde:', error);
        throw error;
      })
    );
  }

  // Letzte Runde löschen für aktuelle Gilde
  letzteRundeLoeschen(): Observable<any> {
    const saisonNum = this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden`)).then((snapshot) => {
        if (!snapshot.exists()) {
          throw new Error('Keine Runden zum Löschen vorhanden');
        }

        const runden = snapshot.val();
        const rundenNummern = Object.keys(runden).map(Number);
        const letzteRunde = Math.max(...rundenNummern);
        const tippCount = Object.keys(runden[letzteRunde].tipps || {}).length;

        return remove(ref(this.db, `gilden/${this.aktuelleGilde}/saisons/${saisonNum}/runden/${letzteRunde}`))
          .then(() => ({
            message: 'Letzte Runde erfolgreich gelöscht',
            geloeschteRunde: letzteRunde,
            saison: saisonNum,
            gilde: this.aktuelleGilde,
            geloeschteEintraege: tippCount
          }));
      }).catch((error) => {
        console.error('Fehler beim Löschen der Runde:', error);
        throw error;
      })
    );
  }

  // Passwort einer Gilde abrufen
  getGildenPasswort(): Observable<string> {
    return from(
      get(
        ref(this.db, `gilden/${this.aktuelleGilde}/passwort`)
      ).then(snapshot => {
        if (snapshot.exists()) {
          return snapshot.val();
        }
        return null;
      }).catch(error => {
        console.error('Fehler beim Abrufen des Passworts:', error);
        return null;
      })
    );
  }
}
