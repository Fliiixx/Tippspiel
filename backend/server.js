import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Datenbankverbindung aufbauen
const dbPromise = open({
  filename: '/data/database.sqlite',
  driver: sqlite3.Database,
});

// Sicherstellen, dass die Tabelle existiert
(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS game_data (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `);
})();

// Endpunkt zum Laden der Daten
app.get('/api/data', async (req, res) => {
  try {
    const db = await dbPromise;
    const result = await db.get('SELECT data FROM game_data WHERE id = 1');
    if (result) {
      res.json(JSON.parse(result.data));
    } else {
      res.json({ runden: [], rangliste: [] });
    }
  } catch (e) {
    console.error('Failed to load data from DB', e);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// Endpunkt zum Speichern der Daten
app.post('/api/data', async (req, res) => {
  try {
    const db = await dbPromise;
    const dataToSave = JSON.stringify(req.body);
    await db.run(
      'INSERT INTO game_data (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      dataToSave
    );
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (e) {
    console.error('Failed to save data to DB', e);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Endpunkt zum Zurücksetzen der Daten
app.delete('/api/data', async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM game_data WHERE id = 1');
    res.status(200).json({ message: 'Data reset successfully' });
  } catch (e) {
    console.error('Failed to reset data in DB', e);
    res.status(500).json({ error: 'Failed to reset data' });
  }
});

// === Datenbank ===
const db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
});

// Tabellen anlegen
await db.exec(`
  CREATE TABLE IF NOT EXISTS tipps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    zahl INTEGER,
    abweichung INTEGER,
    punkte INTEGER,
    platz INTEGER,
    runde INTEGER,
    gewinnzahl INTEGER,
    saison INTEGER
  );
`);

// === Saison-Berechnung ===
function getAktuelleSaison() {
    const startDatum = new Date('2025-07-31');
    const jetzt = new Date();
    const diffMs = jetzt - startDatum;
    const diffWochen = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    return Math.floor(diffWochen / 12) + 1;
}

// === API ===

// Tipp-Runde eintragen (gesamte Runde auf einmal)
app.post("/api/runden", async (req, res) => {
    const { gewinnzahl, tipps } = req.body;
    if (!gewinnzahl || !Array.isArray(tipps)) return res.status(400).send("Ungültige Daten");

    const aktuelleSaison = getAktuelleSaison();
    const runde = (await db.get("SELECT MAX(runde) AS max FROM tipps WHERE saison = ?", aktuelleSaison))?.max || 0;
    const neueRunde = runde + 1;

    const insert = await db.prepare(
        "INSERT INTO tipps (name, zahl, abweichung, punkte, platz, runde, gewinnzahl, saison) VALUES (?,?,?,?,?,?,?,?)"
    );

    for (const t of tipps) {
        await insert.run(t.name, t.zahl, t.abweichung, t.punkte, t.platz, neueRunde, gewinnzahl, aktuelleSaison);
    }

    await insert.finalize();
    res.json({ runde: neueRunde, saison: aktuelleSaison, count: tipps.length });
});

// Rangliste abrufen (aggregiert für aktuelle Saison)
app.get("/api/rangliste", async (_, res) => {
    const aktuelleSaison = getAktuelleSaison();
    const rows = await db.all(`
    SELECT 
      name, 
      SUM(punkte) AS gesamtpunkte,
      SUM(abweichung) AS gesamtabweichung
    FROM tipps
    WHERE saison = ?
    GROUP BY name
    ORDER BY gesamtpunkte DESC, gesamtabweichung ASC;
  `, aktuelleSaison);
    res.json(rows);
});

// Rangliste für eine bestimmte Saison abrufen
app.get("/api/rangliste/:saison", async (req, res) => {
    const saison = parseInt(req.params.saison);
    const rows = await db.all(`
    SELECT 
      name, 
      SUM(punkte) AS gesamtpunkte,
      SUM(abweichung) AS gesamtabweichung
    FROM tipps
    WHERE saison = ?
    GROUP BY name
    ORDER BY gesamtpunkte DESC, gesamtabweichung ASC;
  `, saison);
    res.json(rows);
});

// Alle Runden abrufen (aktuelle Saison)
app.get("/api/runden", async (_, res) => {
    const aktuelleSaison = getAktuelleSaison();
    const runden = await db.all(`
    SELECT DISTINCT runde, gewinnzahl FROM tipps WHERE saison = ? ORDER BY runde DESC;
  `, aktuelleSaison);
    res.json(runden);
});

// Alle Runden einer bestimmten Saison abrufen
app.get("/api/saisons/:saison/runden", async (req, res) => {
    const saison = parseInt(req.params.saison);
    const runden = await db.all(`
    SELECT DISTINCT runde, gewinnzahl FROM tipps WHERE saison = ? ORDER BY runde DESC;
  `, saison);
    res.json(runden);
});

// Ergebnisse einer Runde
app.get("/api/runden/:id", async (req, res) => {
    const runde = parseInt(req.params.id);
    const aktuelleSaison = getAktuelleSaison();
    const tipps = await db.all("SELECT * FROM tipps WHERE runde = ? AND saison = ?", runde, aktuelleSaison);
    res.json(tipps);
});

// Aktuelle Saison abrufen
app.get("/api/saison", async (_, res) => {
    const aktuelleSaison = getAktuelleSaison();
    res.json({ saison: aktuelleSaison });
});

// Alle verfügbaren Saisons abrufen
app.get("/api/saisons", async (_, res) => {
    const saisons = await db.all(`
    SELECT DISTINCT saison FROM tipps ORDER BY saison DESC;
  `);
    res.json(saisons.map(s => s.saison));
});

// Letzte Runde der aktuellen Saison löschen
app.delete("/api/runden/letzte", async (req, res) => {
  try {
    const aktuelleSaison = getAktuelleSaison();
    
    // Höchste Rundennummer in der aktuellen Saison finden
    const result = await db.get(
      "SELECT MAX(runde) AS maxRunde FROM tipps WHERE saison = ?",
      aktuelleSaison
    );
    
    if (!result || result.maxRunde === null) {
      return res.status(404).json({ error: 'Keine Runden zum Löschen vorhanden' });
    }
    
    const letzteRunde = result.maxRunde;
    
    // Alle Tipps der letzten Runde löschen
    const deleteResult = await db.run(
      "DELETE FROM tipps WHERE runde = ? AND saison = ?",
      letzteRunde,
      aktuelleSaison
    );
    
    res.json({ 
      message: 'Letzte Runde erfolgreich gelöscht',
      geloeschteRunde: letzteRunde,
      saison: aktuelleSaison,
      geloeschteEintraege: deleteResult.changes
    });
  } catch (e) {
    console.error('Fehler beim Löschen der letzten Runde', e);
    res.status(500).json({ error: 'Fehler beim Löschen der Runde' });
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
