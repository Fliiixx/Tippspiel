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

  // Alle Saisons abrufen
  getAlleSaisons(): Observable<number[]> {
    return from(
      get(ref(this.db, 'saisons')).then((snapshot) => {
        if (snapshot.exists()) {
          const saisons = Object.keys(snapshot.val()).map(Number);
          return saisons.sort((a, b) => b - a);
        }
        return [];
      }).catch((error) => {
        console.error('Fehler beim Abrufen der Saisons:', error);
        return [];
      })
    );
  }

  // Rangliste abrufen (aktuelle oder spezifische Saison)
  getRangliste(saison?: number): Observable<any[]> {
    const saisonNum = saison || this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `saisons/${saisonNum}/runden`)).then((snapshot) => {
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

  // Runden abrufen (aktuelle oder spezifische Saison)
  getRunden(saison?: number): Observable<any[]> {
    const saisonNum = saison || this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `saisons/${saisonNum}/runden`)).then((snapshot) => {
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

  // Einzelne Runde abrufen
  getRunde(rundeId: number, saisonNum: number): Observable<any[]> {
    //const saisonNum = this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `saisons/${saisonNum}/runden/${rundeId}`)).then((snapshot) => {
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

  // Runde speichern
  speichereRunde(gewinnzahl: number, tipps: any[]): Observable<any> {
    const saisonNum = this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `saisons/${saisonNum}/runden`)).then((snapshot) => {
        const runden = snapshot.val() || {};
        const neueRunde = Math.max(...Object.keys(runden).map(Number), 0) + 1;

        const rundenData: { gewinnzahl: number; tipps: { [key: number]: any } } = {
          gewinnzahl,
          tipps: {}
        };

        tipps.forEach((tipp, index) => {
          rundenData.tipps[index] = tipp;
        });

        return set(ref(this.db, `saisons/${saisonNum}/runden/${neueRunde}`), rundenData)
          .then(() => ({
            runde: neueRunde,
            saison: saisonNum,
            count: tipps.length
          }));
      }).catch((error) => {
        console.error('Fehler beim Speichern der Runde:', error);
        throw error;
      })
    );
  }

  // Letzte Runde löschen
  letzteRundeLoeschen(): Observable<any> {
    const saisonNum = this.getAktuelleSaisonNumber();

    return from(
      get(ref(this.db, `saisons/${saisonNum}/runden`)).then((snapshot) => {
        if (!snapshot.exists()) {
          throw new Error('Keine Runden zum Löschen vorhanden');
        }

        const runden = snapshot.val();
        const rundenNummern = Object.keys(runden).map(Number);
        const letzteRunde = Math.max(...rundenNummern);
        const tippCount = Object.keys(runden[letzteRunde].tipps || {}).length;

        return remove(ref(this.db, `saisons/${saisonNum}/runden/${letzteRunde}`))
          .then(() => ({
            message: 'Letzte Runde erfolgreich gelöscht',
            geloeschteRunde: letzteRunde,
            saison: saisonNum,
            geloeschteEintraege: tippCount
          }));
      }).catch((error) => {
        console.error('Fehler beim Löschen der Runde:', error);
        throw error;
      })
    );
  }
}
