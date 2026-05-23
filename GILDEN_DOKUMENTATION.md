# 🏰 Gilden-System - Dokumentation

## Übersicht

Das Tippspiel wurde um ein **Gilden-System** erweitert. Dieses ermöglicht es, separate Tippspiele für verschiedene Gilden (Gruppen) zu verwalten, jeweils mit eigenen Saisons, Runden und Ranglisten.

## Neue Firebase-Struktur

Die Datenbank-Struktur wurde wie folgt erweitert:

```
gilden/
├── gilde1/
│   └── saisons/
│       ├── 1/
│       │   └── runden/
│       │       ├── 1/
│       │       │   ├── gewinnzahl: number
│       │       │   └── tipps/
│       │       │       ├── 0: { name, zahl, abweichung, punkte, platz }
│       │       │       └── ...
│       │       └── ...
│       └── ...
├── gilde2/
│   └── saisons/
│       └── ...
└── ...
```

## Verwendung im Frontend

### 1. Gildenwahl über URL-Parameter

Die Anwendung unterstützt folgende URL-Muster:

- `http://localhost/ergebnisse` - Standard-Ergebnisse (default Gilde)
- `http://localhost/gilde/MeineGilde/ergebnisse` - Ergebnisse für "MeineGilde"
- `http://localhost/gilde/MeineGilde/tipp-eingabe` - Tipp-Eingabe für "MeineGilde"

### 2. Dynamische Gildenwahl über UI

In beiden Komponenten (Ergebnisse & Tipp-Eingabe) gibt es oben einen **Gildenwahl-Button** (🏰):
- Klick auf den Button öffnet ein Dropdown-Menü
- Alle verfügbaren Gilden aus der Firebase-DB werden angezeigt
- Auswahl einer Gilde lädt automatisch die entsprechenden Daten

### 3. Gildenspeicherung im Browser

Die zuletzt ausgewählte Gilde wird im `localStorage` des Browsers gespeichert und wird beim nächsten Besuch automatisch geladen.

## Technische Änderungen

### Storage Service (`storage.service.ts`)

Neue Methoden:

```typescript
// Aktuelle Gilde abrufen
getAktuelleGilde(): string

// Aktuelle Gilde setzen
setAktuelleGilde(gildeName: string): void

// Alle verfügbaren Gilden abrufen
getAlleGilden(): Observable<string[]>
```

**Wichtig:** Alle bestehenden Methoden (`getRangliste`, `getRunden`, etc.) wurden aktualisiert, um die aktuelle Gilde zu berücksichtigen. Sie nutzen den Pfad:
```
gilden/{aktuelleGilde}/saisons/{saisonNum}/runden/...
```

### Komponenten

#### ErgebnisseComponent
- Route-Parameter `:name` wird gelesen und als Gilde gesetzt
- `loadGilden()` lädt alle verfügbaren Gilden
- `waehleGilde(gildeName)` wechselt die Gilde und navigiert zur neuen Route

#### TippEingabeComponent
- Identische Gildenverwaltung wie ErgebnisseComponent
- Beim Speichern wird die Gilde mitgesendet (Feedback-Nachricht)

### Routes (`app.routes.ts`)

```typescript
// Standard-Routes (ohne Gilde)
{ path: '', redirectTo: '/ergebnisse', pathMatch: 'full' },
{ path: 'tipp-eingabe', component: TippEingabeComponent },
{ path: 'ergebnisse', component: ErgebnisseComponent },

// Gildenspeziifische Routes
{ path: 'gilde/:name/tipp-eingabe', component: TippEingabeComponent },
{ path: 'gilde/:name/ergebnisse', component: ErgebnisseComponent },
{ path: 'gilde/:name', redirectTo: '/gilde/:name/ergebnisse', pathMatch: 'full' },
```

## Erste Verwendung

### Neue Gilde erstellen

1. **Manuelle Erstellung in Firebase Console:**
   - Gehen Sie zu `Realtime Database`
   - Erstellen Sie eine neue Struktur:
     ```
     gilden/
     └── MeineGildenname/
         └── saisons/
     ```

2. **Erste Runde in der Gilde speichern:**
   - Öffnen Sie `/gilde/MeineGildenname/tipp-eingabe`
   - Geben Sie die Daten ein und speichern Sie
   - Die Struktur wird automatisch erstellt

### Zwischen Gilden wechseln

- Klicken Sie auf den **🏰 Gildenwahl-Button**
- Wählen Sie die gewünschte Gilde aus der Liste
- Die Seite lädt automatisch neu mit den Daten der ausgewählten Gilde

## Hinweise zur Migration

Falls Sie bereits vorhandene Daten haben:

1. **Alte Struktur (ohne Gilden):**
   ```
   saisons/
   └── 1/
       └── runden/
   ```

2. **Neue Struktur (mit Gilden):**
   ```
   gilden/
   └── default/
       └── saisons/
   ```

Sie müssen die alten Daten manuell in die neue Struktur verschieben oder einen Migrationsskript ausführen.

## Fehlerbehebung

### "Keine Gilden verfügbar"
- Überprüfen Sie, ob der Pfad `gilden/` in der Firebase-Datenbank existiert
- Stellen Sie sicher, dass mindestens eine Gilde dort eingetragen ist

### Daten werden nicht geladen
- Überprüfen Sie die Gildennamen auf Groß-/Kleinschreibung
- Stellen Sie sicher, dass die Gilde den Pfad `gilden/{gildeName}/saisons/` hat

### localStorage löschen
Falls die gespeicherte Gilde Probleme verursacht:
```javascript
localStorage.removeItem('aktuelleGilde');
```

## Weitere Entwicklung

Mögliche zukünftige Erweiterungen:

- [ ] Gildenverwaltungsseite (Erstellen, Löschen, Bearbeiten)
- [ ] Benutzer-zu-Gilde-Zuordnung
- [ ] Gildenbezogene Statistiken und Grafiken
- [ ] Einladungssystem für Gildenmitglieder
- [ ] Gildenübergreifende Rankings

