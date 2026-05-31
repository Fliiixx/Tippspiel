import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DecimalPipe, NgClass, NgForOf, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StorageService } from '../services/storage.service';
import { PersistedData, Runde, Spieler } from '../models';

@Component({
  selector: 'app-ergebnisse',
  standalone: true,
  imports: [NgIf, NgForOf, FormsModule, DecimalPipe, NgClass],
  templateUrl: './ergebnisse.component.html',
  styleUrl: './ergebnisse.component.css',
})
export class ErgebnisseComponent implements OnInit {

  // ===== STATE =====
  daten: PersistedData = { runden: [], rangliste: [] };

  aktuelleGilde = 'default';
  alleGilden: string[] = [];
  showGildenMenu = false;

  alleSaisons: number[] = [];
  aktuelleSaison!: number;

  angezeigteRundeIndex = -1;
  angezeigteRundeNummer: number | null = null;

  rundenCache: Map<number, any[]> = new Map();
  ranglisteCache: Map<number, Spieler[]> = new Map();
  preise: number[] = [];

  constructor(
    private storage: StorageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ================= INIT =================

  ngOnInit() {
    let previousGilde: string | null = null;
    let previousSaison: number | null = null;

    this.route.params.subscribe(params => {
      const currentGilde = params['gildenname'] || params['name'] || this.storage.getAktuelleGilde();
      const currentSaison = params['saison'] ? parseInt(params['saison'], 10) : null;
      const requestedRunde = params['runde'] ? parseInt(params['runde'], 10) : null;

      // Nur laden, wenn sich Gilde oder Saison ändert, nicht wenn sich nur die Runde ändert
      const gildeChanged = previousGilde !== currentGilde;
      const saisonChanged = previousSaison !== currentSaison;

      if (gildeChanged || saisonChanged) {
        this.aktuelleGilde = currentGilde;
        this.storage.setAktuelleGilde(this.aktuelleGilde);

        // Lade Daten neu wenn Gilde oder Saison sich ändert
        this.loadInitialData(currentSaison, requestedRunde);

        previousGilde = currentGilde;
        previousSaison = currentSaison;
      } else if (requestedRunde !== null) {
        // Wenn nur die Runde sich ändert, wechsle nur die Runde
        this.navigateToRunde(requestedRunde);
      }
    });

    this.storage.getPreise().subscribe(p => this.preise = p);
  }

  private navigateToRunde(rundeNummer: number) {
    const index = this.daten.runden.findIndex(r => r.rundenNummer === rundeNummer);
    if (index >= 0) {
      this.angezeigteRundeIndex = index;
      this.angezeigteRundeNummer = rundeNummer;
      this.loadRundeDetails(index);
    }
  }

  // ================= DATA LOADING =================

  private loadInitialData(requestedSaison: number | null, requestedRunde: number | null) {
    this.loadGilden();

    this.storage.getAlleSaisons().subscribe({
      next: (saisons) => {
        this.alleSaisons = saisons;

        let saisonToLoad: number;

        if (saisons.length === 0) {
          saisonToLoad = this.storage.getAktuelleSaisonNumber();
        } else {
          saisonToLoad = requestedSaison && saisons.includes(requestedSaison)
            ? requestedSaison
            : Math.max(...saisons);
        }

        this.aktuelleSaison = saisonToLoad;

        // Beim initialen Load die Rangliste laden (loadRangliste: true)
        this.loadSaison(saisonToLoad, requestedRunde, true);
      },
      error: (err) => console.error('Saison-Load Fehler', err)
    });
  }

  private loadGilden() {
    this.storage.getAlleGilden().subscribe({
      next: (gilden) => {
        this.alleGilden = gilden.length ? gilden : ['default'];

        if (!this.alleGilden.includes(this.aktuelleGilde)) {
          this.aktuelleGilde = this.alleGilden[0];
          this.storage.setAktuelleGilde(this.aktuelleGilde);
        }
      }
    });
  }

  // ================= SAISON =================

  loadSaison(saison: number, requestedRunde: number | null = null, loadRangliste: boolean = false) {
    this.aktuelleSaison = saison;

    // Wenn Rangliste im Cache ist oder wir sie nicht laden wollen, nur Runden laden
    if (!loadRangliste && this.ranglisteCache.has(saison)) {
      this.daten.rangliste = this.ranglisteCache.get(saison)!;
      this.loadRundenFuerSaison(saison, requestedRunde, false);
    } else if (loadRangliste) {
      // Lade beide: Runden und Rangliste
      forkJoin({
        runden: this.storage.getRunden(saison),
        rangliste: this.storage.getRangliste(saison)
      }).subscribe({
        next: (res) => {
          // Cache die Rangliste
          const rangliste = res.rangliste;
          this.ranglisteCache.set(saison, rangliste);
          this.daten.rangliste = rangliste;

          this.processRundenData(res.runden, saison, requestedRunde, true);
        },
        error: (err) => console.error('Saison Load Fehler', err)
      });
    } else {
      // Rangliste nicht im Cache und nicht angefordert - nur Runden laden
      this.loadRundenFuerSaison(saison, requestedRunde, false);
    }
  }

  private loadRundenFuerSaison(saison: number, requestedRunde: number | null, shouldCalculateRangliste: boolean) {
    this.storage.getRunden(saison).subscribe({
      next: (runden) => {
        this.processRundenData(runden, saison, requestedRunde, shouldCalculateRangliste);
      },
      error: (err) => console.error('Runden Load Fehler', err)
    });
  }

  private processRundenData(runden: any[], saison: number, requestedRunde: number | null, shouldCalculateRangliste: boolean = false) {
    // Runden normalisieren
    this.daten.runden = runden
      .map(r => ({
        rundenNummer: r.runde,
        gewinnzahl: r.gewinnzahl,
        tipps: [],
        saison
      }))
      .sort((a, b) => a.rundenNummer - b.rundenNummer);

    this.rundenCache.clear();

    // Stelle die richtige Runde ein basierend auf requestedRunde oder neueste
    if (requestedRunde !== null) {
      const index = this.daten.runden.findIndex(r => r.rundenNummer === requestedRunde);
      this.angezeigteRundeIndex = index >= 0 ? index : (this.daten.runden.length ? this.daten.runden.length - 1 : -1);
      this.angezeigteRundeNummer = requestedRunde;
    } else {
      this.angezeigteRundeIndex =
        this.daten.runden.length ? this.daten.runden.length - 1 : -1;
      this.angezeigteRundeNummer = this.angezeigteRunde?.rundenNummer ?? null;
    }

    // Nur Rangänderungen berechnen, wenn die Rangliste neu geladen wurde
    if (shouldCalculateRangliste) {
      this.berechneRangaenderungen();
    }

    if (this.angezeigteRundeIndex >= 0) {
      this.loadRundeDetails(this.angezeigteRundeIndex);
      this.updateRouteParams();
    }
  }

  // ================= RUNDE DETAILS =================

  loadRundeDetails(index: number) {
    if (index < 0 || index >= this.daten.runden.length) return;

    const runde = this.daten.runden[index];
    const id = runde.rundenNummer!;

    if (this.rundenCache.has(id)) {
      runde.tipps = this.rundenCache.get(id)!;
      return;
    }

    this.storage.getRunde(id, this.aktuelleSaison).subscribe({
      next: (tipps) => {
        const mapped = tipps.map(t => ({
          name: t.name,
          zahl: t.zahl,
          abweichung: t.abweichung,
          punkte: t.punkte,
          platz: t.platz
        }));

        this.rundenCache.set(id, mapped);
        runde.tipps = mapped;
      }
    });
  }

  // ================= NAVIGATION =================

  get angezeigteRunde(): Runde | null {
    return this.daten.runden[this.angezeigteRundeIndex] ?? null;
  }

  vorherigeRunde() {
    if (this.angezeigteRundeIndex > 0) {
      this.angezeigteRundeIndex--;
      this.loadRundeDetails(this.angezeigteRundeIndex);
      this.updateRouteParams();
    }
  }

  naechsteRunde() {
    if (this.angezeigteRundeIndex < this.daten.runden.length - 1) {
      this.angezeigteRundeIndex++;
      this.loadRundeDetails(this.angezeigteRundeIndex);
      this.updateRouteParams();
    }
  }

  private updateRouteParams() {
    if (this.angezeigteRunde && this.angezeigteRunde.rundenNummer) {
      this.router.navigate(
        ['/gilde', this.aktuelleGilde, 'saison', this.aktuelleSaison, 'runde', this.angezeigteRunde.rundenNummer],
        { replaceUrl: true }
      );
    }
  }

  // ================= SAISON DATUM =================

  getSaisonDatumsrahmen(saison: number): string {
    const start = new Date('2025-07-31T00:00:00Z');
    const wochenProSaison = 12;

    const startDate = new Date(start);
    startDate.setDate(startDate.getDate() + (saison - 1) * wochenProSaison * 7);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + wochenProSaison * 7 - 1);

    const fmt = (d: Date) =>
      d.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

    return `${fmt(startDate)} - ${fmt(endDate)}`;
  }

  // ================= KEYBOARD =================

  @HostListener('window:keydown', ['$event'])
  handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') this.vorherigeRunde();
    if (e.key === 'ArrowRight') this.naechsteRunde();
  }

  // ================= GILDEN =================

  waehleGilde(name: string) {
    this.aktuelleGilde = name;
    this.storage.setAktuelleGilde(name);
    this.showGildenMenu = false;
    this.router.navigate(['/gilde', name, 'saison']);
  }


  private berechneRangaenderungen() {
    if (this.daten.runden.length === 0) return;

    // Hole die letzte Runde
    const letzteRunde = this.daten.runden[this.daten.runden.length - 1];
    const vorletzteRunde = this.daten.runden.length > 1 ? this.daten.runden[this.daten.runden.length - 2] : null;

    if (!vorletzteRunde) {
      // Erste Runde: alle Spieler sind neu, keine Rangänderung
      this.daten.rangliste.forEach(spieler => {
        spieler.rangaenderung = undefined;
      });
      return;
    }

    // Berechne Rangliste bis zur vorletzten Runde
    const vorletzteRundenNummer = vorletzteRunde.rundenNummer!;

    this.storage.getRanglisteBisRunde(vorletzteRundenNummer, this.aktuelleSaison).subscribe({
      next: (vorherigeRangliste) => {
        // Erstelle Map für schnellen Zugriff auf alte Ränge
        const alteRaenge = new Map<string, number>();
        vorherigeRangliste.forEach((spieler, index) => {
          alteRaenge.set(spieler.name, index + 1);
        });

        // Berechne Rangänderung für jeden Spieler
        this.daten.rangliste.forEach((spieler, index) => {
          const neuerRang = index + 1;
          const alterRang = alteRaenge.get(spieler.name);

          if (alterRang === undefined) {
            // Neuer Spieler: setze auf letzten Platz der vorigen Runde
            spieler.rangaenderung = vorherigeRangliste.length - neuerRang;
          } else {
            // Bestehender Spieler: Differenz berechnen (positiv = aufgestiegen)
            spieler.rangaenderung = alterRang - neuerRang;
          }
        });
      },
      error: (err) => console.error('Fehler beim Berechnen der Rangänderungen', err)
    });
  }

}
