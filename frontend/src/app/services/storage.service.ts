import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PersistedData } from '../models';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api';



  // Neue Saison-basierte Methoden
  getAktuelleSaison(): Observable<{ saison: number }> {
    return this.http.get<{ saison: number }>(`${this.baseUrl}/saison`);
  }

  getAlleSaisons(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/saisons`);
  }

  getRangliste(saison?: number): Observable<any[]> {
    const url = saison
      ? `${this.baseUrl}/rangliste/${saison}`
      : `${this.baseUrl}/rangliste`;
    return this.http.get<any[]>(url);
  }

  getRunden(saison?: number): Observable<any[]> {
    const url = saison
      ? `${this.baseUrl}/saisons/${saison}/runden`
      : `${this.baseUrl}/runden`;
    return this.http.get<any[]>(url);
  }

  getRunde(rundeId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/runden/${rundeId}`);
  }

  speichereRunde(gewinnzahl: number, tipps: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/runden`, { gewinnzahl, tipps });
  }

  letzteRundeLoeschen(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/runden/letzte`);
  }
}
