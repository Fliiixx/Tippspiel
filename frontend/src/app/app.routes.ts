import { Routes } from '@angular/router';
import { TippEingabeComponent } from './tipp-eingabe/tipp-eingabe.component';
import { ErgebnisseComponent } from './ergebnisse/ergebnisse.component';

export const routes: Routes = [
  { path: '', redirectTo: '/ergebnisse', pathMatch: 'full' },
  { path: 'tipp-eingabe', component: TippEingabeComponent },
  { path: 'ergebnisse', component: ErgebnisseComponent },
];
