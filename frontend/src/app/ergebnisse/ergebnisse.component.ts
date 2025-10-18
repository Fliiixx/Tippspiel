import { Component, HostListener, OnInit } from '@angular/core';
import {PersistedData, Runde, Spieler} from '../models';
import { StorageService } from '../services/storage.service';
import {DecimalPipe, NgClass, NgForOf, NgIf} from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-ergebnisse',
  standalone: true,
  imports: [NgIf, NgForOf, FormsModule, DecimalPipe, NgClass],
  templateUrl: './ergebnisse.component.html',
  styleUrl: './ergebnisse.component.css',
})
export class ErgebnisseComponent implements OnInit {
  daten: PersistedData = { runden: [], rangliste: [] };
  angezeigteRundeIndex = -1;
  aktuelleSaison = 1;
  alleSaisons: number[] = [];
  rundenDetails: Map<number, any[]> = new Map();

  constructor(private storage: StorageService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    forkJoin({
      saison: this.storage.getAktuelleSaison(),
      saisons: this.storage.getAlleSaisons(),
      runden: this.storage.getRunden(),
      rangliste: this.storage.getRangliste()
    }).subscribe({
      next: (result) => {
        this.aktuelleSaison = result.saison.saison;
        this.alleSaisons = result.saisons;

        // Runden mit korrekter Runden-ID speichern
        this.daten.runden = result.runden.map((r) => ({
          gewinnzahl: r.gewinnzahl,
          tipps: [],
          rundenNummer: r.runde  // Verwende die tatsächliche Rundennummer aus der DB
        }))
          .sort((a, b) => a.rundenNummer - b.rundenNummer);;

        // Rangliste in das alte Format konvertieren
        this.daten.rangliste = result.rangliste.map(r => ({
          name: r.name,
          gesamtpunkte: r.gesamtpunkte,
          gesamtabweichung: r.gesamtabweichung
        }));

        if (this.daten.runden.length > 0) {
          this.angezeigteRundeIndex = this.daten.runden.length - 1;
          this.ladeRundenDetails(this.angezeigteRundeIndex);
        }
      },
      error: (err) => console.error('Fehler beim Laden der Daten', err)
    });
  }

  ladeSaison(saison: number) {
    forkJoin({
      runden: this.storage.getRunden(saison),
      rangliste: this.storage.getRangliste(saison)
    }).subscribe({
      next: (result) => {
        this.aktuelleSaison = saison;
        this.rundenDetails.clear();

        // Runden mit korrekter Runden-ID speichern
        this.daten.runden = result.runden.map((r) => ({
          gewinnzahl: r.gewinnzahl,
          tipps: [],
          rundenNummer: r.runde  // Verwende die tatsächliche Rundennummer aus der DB
        }))
          .sort((a, b) => a.rundenNummer - b.rundenNummer);

        this.daten.rangliste = result.rangliste.map(r => ({
          name: r.name,
          gesamtpunkte: r.gesamtpunkte,
          gesamtabweichung: r.gesamtabweichung
        }));

        if (this.daten.runden.length > 0) {
          this.angezeigteRundeIndex = this.daten.runden.length - 1;
          this.ladeRundenDetails(this.angezeigteRundeIndex);
        } else {
          this.angezeigteRundeIndex = -1;
        }
      },
      error: (err) => console.error('Fehler beim Laden der Saison', err)
    });
  }

  ladeRundenDetails(index: number) {
    if (index < 0 || index >= this.daten.runden.length) return;

    const runde = this.daten.runden[index];
    const rundenNummer:number  = <number>runde.rundenNummer;  // Verwende direkt die rundenNummer

    // Prüfen, ob Details bereits geladen wurden
    if (this.rundenDetails.has(rundenNummer)) {
      runde.tipps = this.rundenDetails.get(rundenNummer)!;
      return;
    }

    // Details vom Backend laden
    this.storage.getRunde(rundenNummer).subscribe({
      next: (tipps) => {
        const formattedTipps = tipps.map(t => ({
          name: t.name,
          zahl: t.zahl,
          abweichung: t.abweichung,
          punkte: t.punkte,
          platz: t.platz
        }));

        this.rundenDetails.set(rundenNummer, formattedTipps);
        runde.tipps = formattedTipps;
      },
      error: (err) => console.error('Fehler beim Laden der Rundendetails', err)
    });
  }

  get angezeigteRunde(): Runde | null {
    if (
      this.angezeigteRundeIndex >= 0 &&
      this.angezeigteRundeIndex < this.daten.runden.length
    ) {
      return this.daten.runden[this.angezeigteRundeIndex];
    }
    return null;
  }

  vorherigeRunde() {
    if (this.angezeigteRundeIndex > 0) {
      this.angezeigteRundeIndex--;
      this.ladeRundenDetails(this.angezeigteRundeIndex);
    }
  }

  naechsteRunde() {
    if (this.angezeigteRundeIndex < this.daten.runden.length - 1) {
      this.angezeigteRundeIndex++;
      this.ladeRundenDetails(this.angezeigteRundeIndex);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      this.vorherigeRunde();
    } else if (event.key === 'ArrowRight') {
      this.naechsteRunde();
    }
  }



  getSaisonDatumsrahmen(saison: number): string {
    const startDatum = new Date('2025-07-31');
    const wochenProSaison = 12;

    const startWoche = (saison - 1) * wochenProSaison;
    const endWoche = saison * wochenProSaison - 1;

    const saisonStart = new Date(startDatum);
    saisonStart.setDate(saisonStart.getDate() + (startWoche * 7));

    const saisonEnde = new Date(startDatum);
    saisonEnde.setDate(saisonEnde.getDate() + (endWoche * 7) + 6);

    const formatDatum = (datum: Date) => {
      return datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return `${formatDatum(saisonStart)} - ${formatDatum(saisonEnde)}`;
  }

  private berechneRanglisteNeu(runden: Runde[]): Spieler[] {
    const rangMap: Map<string, { punkte: number; abweichung: number }> = new Map();
    const punkteSchema = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    for (const runde of runden) {
      runde.tipps.forEach((tipp, index) => {
        const punkte = punkteSchema[index] || 0;
        const bisherige = rangMap.get(tipp.name) || { punkte: 0, abweichung: 0 };
        rangMap.set(tipp.name, {
          punkte: bisherige.punkte + punkte,
          abweichung: bisherige.abweichung + tipp.abweichung
        });
      });
    }

    const rangliste = Array.from(rangMap.entries()).map(([name, data]) => ({
      name,
      gesamtpunkte: data.punkte,
      gesamtabweichung: data.abweichung,
    }));

    rangliste.sort((a, b) => {
      if (b.gesamtpunkte !== a.gesamtpunkte) {
        return b.gesamtpunkte - a.gesamtpunkte;
      }
      return a.gesamtabweichung - b.gesamtabweichung;
    });
    return rangliste;
  }
}
