import { Component, OnInit } from '@angular/core';
import { Tipp, PersistedData } from '../models';
import { StorageService } from '../services/storage.service';
import {DecimalPipe, NgForOf, NgIf} from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-tipp-eingabe',
  imports: [NgIf, NgForOf, FormsModule, DecimalPipe],
  templateUrl: './tipp-eingabe.component.html',
  standalone: true,
  styleUrl: './tipp-eingabe.component.css',
})
export class TippEingabeComponent implements OnInit {
  tippText = ``;
  gewinnzahl!: number;
  daten: PersistedData = { runden: [], rangliste: [] };
  letzterGewinner: Tipp | null = null;
  punkteSchema = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  aktuelleSaison = 1;
  alleSaisons: number[] = [];

  // Passwortschutz
  istFreigeschaltet = false;
  passwortEingabe = '';
  private korrektePasswort = 'Mond';
  private readonly localStorageKey = 'tippspiel_auth';

  // Gilden-Verwaltung
  alleGilden: string[] = [];
  aktuelleGilde: string = 'default';
  showGildenMenu = false;

  constructor(private storage: StorageService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    // Gilde aus Route-Parameter laden
    this.route.params.subscribe(params => {
      if (params['name']) {
        this.aktuelleGilde = params['name'];
        this.storage.setAktuelleGilde(this.aktuelleGilde);
      } else {
        this.aktuelleGilde = this.storage.getAktuelleGilde();
      }
      this.storage.getGildenPasswort().subscribe(passwort => {
        this.korrektePasswort = passwort;
      });
      this.pruefeLocalStorage();
      this.loadData();
    });

    // Alle Gilden laden
    this.loadGilden();
  }

  loadGilden() {
    this.storage.getAlleGilden().subscribe({
      next: (gilden) => {
        this.alleGilden = gilden.length > 0 ? gilden : ['default'];
        if (!this.alleGilden.includes(this.aktuelleGilde)) {
          this.aktuelleGilde = this.alleGilden[0];
          this.storage.setAktuelleGilde(this.aktuelleGilde);
          this.loadData();
        }
      },
      error: (err) => {
        console.error('Fehler beim Laden der Gilden', err);
        this.alleGilden = ['default'];
        this.aktuelleGilde = 'default';
      }
    });
  }

  waehleGilde(gildeName: string) {
    this.aktuelleGilde = gildeName;
    this.storage.setAktuelleGilde(gildeName);
    this.showGildenMenu = false;
    this.router.navigate(['/gilde', gildeName, 'tipp-eingabe']);
  }

  private pruefeLocalStorage() {
    const gespeichertesPasswort = localStorage.getItem(this.localStorageKey);
    if (gespeichertesPasswort === this.korrektePasswort) {
      this.istFreigeschaltet = true;
    }
  }

  passwortPruefen() {

    if (this.passwortEingabe === this.korrektePasswort) {
      this.istFreigeschaltet = true;
      localStorage.setItem(this.localStorageKey, this.passwortEingabe);
      this.passwortEingabe = '';
    } else {
      alert('Falsches Passwort!');
      this.passwortEingabe = '';
    }
  }

  private loadData() {

    forkJoin({
      erste: this.storage.getErsterVerfuegbareSaison(),
      letzte: this.storage.getAktuellsteVerfuegbareSaison(),
      saisons: this.storage.getAlleSaisons()
    }).subscribe({

      next: (meta) => {

        this.aktuelleSaison = meta.letzte;
        this.alleSaisons = meta.saisons.sort((a,b)=>a-b);

        let x = this.getNaechsteSaison();

        if(x){
          this.alleSaisons.push(x);
        }

        forkJoin({
          rangliste: this.storage.getRangliste(this.aktuelleSaison),
          runden: this.storage.getRunden(this.aktuelleSaison)
        }).subscribe({

          next: (result) => {

            this.daten.rangliste = result.rangliste.map(r => ({
              name: r.name,
              gesamtpunkte: r.gesamtpunkte,
              gesamtabweichung: r.gesamtabweichung
            }));

            this.daten.runden = result.runden;

            this.updateTippTextWithPlayerNames();
          }

        });

      }

    });
  }

  private updateTippTextWithPlayerNames() {
    if (this.daten && this.daten.rangliste && this.daten.rangliste.length > 0) {
      const playerNames = this.daten.rangliste.map((spieler) => spieler.name);
      playerNames.sort((a, b) => a.localeCompare(b));
      this.tippText = playerNames.join('\n');
    } else {
      this.tippText = '';
    }
  }

  auswerten() {
    // 1. Gewinnzahl verarbeiten
    let gewinnzahl: number;
    if (this.gewinnzahl == null) {
      alert('Bitte eine gültige Gewinnzahl eingeben!');
      return;
    }

    const gewinnzahlStr = String(this.gewinnzahl).replace(',', '.').replace('%', '').trim();
    gewinnzahl = parseFloat(gewinnzahlStr);

    if (Number.isNaN(gewinnzahl)) {
      alert('Die eingegebene Gewinnzahl ist ungültig!');
      return;
    }

    // 2. Tipps parsen
    const lines = this.tippText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => /[0-9]+(?:[.,][0-9]+)?\s*%?$/.test(l));

    const tipps: Tipp[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        alert(`Die Zeile "${line}" hat ein ungültiges Format. Format: "Name Zahl"`);
        return;
      }

      // Suche von hinten nach der ersten gültigen Zahl (mit %, , oder .)
      let zahlIndex = -1;
      let zahlStrRaw = '';

      for (let i = parts.length - 1; i >= 0; i--) {
        const testStr = parts[i].replace(',', '.').replace('%', '');
        const testZahl = parseFloat(testStr);

        // Prüfe ob es eine gültige Dezimalzahl ist (nicht nur Teil eines Namens)
        if (!Number.isNaN(testZahl) && /^[\d,\.%]+$/.test(parts[i])) {
          zahlIndex = i;
          zahlStrRaw = parts[i];
          break;
        }
      }

      if (zahlIndex === -1) {
        alert(`Konnte keine gültige Zahl in der Zeile "${line}" finden.`);
        return;
      }

      const name = parts.slice(0, zahlIndex).join(' ');
      const zahlStr = zahlStrRaw.replace(',', '.').replace('%', '');
      const zahl = parseFloat(zahlStr);

      if (!name || Number.isNaN(zahl)) {
        alert(`Konnte die Zahl für "${name}" in der Zeile "${line}" nicht verarbeiten.`);
        return;
      }
      tipps.push({ name, zahl, abweichung: 0, punkte: 0, platz: 0 });
    }

    // Abweichungen berechnen
    tipps.forEach((t) => (t.abweichung = Math.abs(t.zahl - gewinnzahl)));

    // Sortieren nach Abweichung, dann nach Name
    tipps.sort((a, b) => {
      if (a.abweichung !== b.abweichung) return a.abweichung - b.abweichung;
      return a.name.localeCompare(b.name);
    });

    // Platz und Punkte zuweisen
    tipps.forEach((t, idx) => {
      t.platz = idx + 1;
      t.punkte = this.punkteSchema[idx] || 0;
    });

    // Letzter Gewinner
    this.letzterGewinner = tipps.length ? tipps[0] : null;

    // Runde an Backend senden
    this.storage.speichereRunde(gewinnzahl, tipps, this.aktuelleSaison).subscribe({
      next: (response) => {
        console.log('Runde erfolgreich gespeichert:', response);
        alert(`Runde ${response.runde} (Saison ${this.aktuelleSaison}) in Gilde "${response.gilde}" erfolgreich gespeichert!`);

        // Daten neu laden
        this.loadData();

        // Gewinnzahl zurücksetzen
        this.gewinnzahl = null as any;
      },
      error: (err) => {
        console.error('Fehler beim Speichern der Runde', err);
        alert('Fehler beim Speichern der Runde!');
      }
    });
  }

  letzteRundeLoeschen() {
    if (
      !confirm(
        'Willst du die letzte Runde wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
      )
    ) {
      return;
    }

    if (this.daten.runden.length === 0) {
      alert('Es gibt keine Runden zum Löschen.');
      return;
    }

    this.storage.letzteRundeLoeschen(this.aktuelleSaison).subscribe({
      next: (response) => {
        console.log('Letzte Runde gelöscht:', response);
        alert(`Runde ${response.geloeschteRunde} (Saison ${this.aktuelleSaison} wurde erfolgreich aus Gilde "${response.gilde}" gelöscht.`);
        this.loadData()

      },
      error: (err) => {
        console.error('Fehler beim Löschen der letzten Runde', err);
        alert('Fehler beim Löschen der Runde!');
      }
    });
  }

  async ausZwischenablageEinfuegen() {
    try {
      const text = await navigator.clipboard.readText();
      this.tippText = text;
    } catch (err) {
      console.error('Fehler beim Lesen der Zwischenablage:', err);
      alert('Konnte nicht aus der Zwischenablage lesen. Bitte manuell einfügen (Strg+V).');
    }
  }

  get displaySaison(): number {
    return this.aktuelleSaison;
  }

  ladeSaison(saison: number) {
    this.aktuelleSaison = saison;
    this.storage.getRangliste(this.aktuelleSaison).subscribe({
      next: (result) => {
        this.daten.rangliste = result.map(r => ({
          name: r.name,
          gesamtpunkte: r.gesamtpunkte,
          gesamtabweichung: r.gesamtabweichung
        }));
        this.updateTippTextWithPlayerNames();
      },
      error: (err) => {
        console.error('Fehler beim Laden der Rangliste für Saison', saison, err);
        this.updateTippTextWithPlayerNames();
      }
    });
  }

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

  getNaechsteSaison() {
    const aktuelle = this.storage.getAktuelleSaisonNumber();
    const existiert = this.alleSaisons.includes(aktuelle);

    return existiert ? null : aktuelle;
  }

}
