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

  rundenCache: Map<number, any[]> = new Map();
  preise: number[] = [];

  constructor(
    private storage: StorageService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  // ================= INIT =================

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.aktuelleGilde = params['name'] || this.storage.getAktuelleGilde();
      this.storage.setAktuelleGilde(this.aktuelleGilde);

      this.loadInitialData();
    });

    this.storage.getPreise().subscribe(p => this.preise = p);
  }

  // ================= DATA LOADING =================

  private loadInitialData() {
    this.loadGilden();

    this.storage.getAlleSaisons().subscribe({
      next: (saisons) => {
        this.alleSaisons = saisons;

        if (saisons.length === 0) {
          this.aktuelleSaison = this.storage.getAktuelleSaisonNumber();
          return;
        }

        this.aktuelleSaison = Math.max(...saisons);

        this.loadSaison(this.aktuelleSaison);
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

  loadSaison(saison: number) {
    this.aktuelleSaison = saison;

    forkJoin({
      runden: this.storage.getRunden(saison),
      rangliste: this.storage.getRangliste(saison)
    }).subscribe({
      next: (res) => {

        // Runden normalisieren
        this.daten.runden = res.runden
          .map(r => ({
            rundenNummer: r.runde,
            gewinnzahl: r.gewinnzahl,
            tipps: [],
            saison
          }))
          .sort((a, b) => a.rundenNummer - b.rundenNummer);

        this.daten.rangliste = res.rangliste;

        this.rundenCache.clear();

        this.angezeigteRundeIndex =
          this.daten.runden.length ? this.daten.runden.length - 1 : -1;

        this.berechneRangaenderungen();

        if (this.angezeigteRundeIndex >= 0) {
          this.loadRundeDetails(this.angezeigteRundeIndex);
        }
      },
      error: (err) => console.error('Saison Load Fehler', err)
    });
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
    }
  }

  naechsteRunde() {
    if (this.angezeigteRundeIndex < this.daten.runden.length - 1) {
      this.angezeigteRundeIndex++;
      this.loadRundeDetails(this.angezeigteRundeIndex);
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
    this.router.navigate(['/gilde', name, 'ergebnisse']);
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
