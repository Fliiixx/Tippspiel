import { Component, OnInit } from '@angular/core';
import { Runde, Tipp, PersistedData, Spieler } from '../models';
import { StorageService } from '../services/storage.service';
import {DecimalPipe, NgForOf, NgIf} from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

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

  // Passwortschutz
  istFreigeschaltet = false;
  passwortEingabe = '';
  private readonly korrektePasswort = 'Mond';
  private readonly localStorageKey = 'tippspiel_auth';

  constructor(private storage: StorageService) {}

  ngOnInit() {
    this.pruefeLocalStorage();
    this.loadData();
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
      saison: this.storage.getAktuelleSaison(),
      rangliste: this.storage.getRangliste(),
      runden: this.storage.getRunden() // Runden auch laden
    }).subscribe({
      next: (result) => {
        this.aktuelleSaison = result.saison.saison;
        this.daten.rangliste = result.rangliste.map(r => ({
          name: r.name,
          gesamtpunkte: r.gesamtpunkte,
          gesamtabweichung: r.gesamtabweichung
        }));
        this.daten.runden = result.runden; // Runden in daten speichern
        this.updateTippTextWithPlayerNames();
      },
      error: (err) => {
        console.error('Fehler beim Laden der Daten', err);
        this.updateTippTextWithPlayerNames();
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
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

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
    this.storage.speichereRunde(gewinnzahl, tipps).subscribe({
      next: (response) => {
        console.log('Runde erfolgreich gespeichert:', response);
        alert(`Runde ${response.runde} (Saison ${response.saison}) erfolgreich gespeichert!`);

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

    this.storage.letzteRundeLoeschen().subscribe({
      next: (response) => {
        console.log('Letzte Runde gelöscht:', response);
        alert(`Runde ${response.geloeschteRunde} wurde erfolgreich gelöscht.`);
        this.loadData()

      },
      error: (err) => {
        console.error('Fehler beim Löschen der letzten Runde', err);
        alert('Fehler beim Löschen der Runde!');
      }
    });
  }


}
