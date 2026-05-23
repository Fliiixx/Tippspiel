import { Routes } from '@angular/router';
import { TippEingabeComponent } from './tipp-eingabe/tipp-eingabe.component';
import { ErgebnisseComponent } from './ergebnisse/ergebnisse.component';

export const routes: Routes = [
  {
    path: 'gilde/:name',
    children: [
      { path: 'ergebnisse', component: ErgebnisseComponent },
      { path: 'tipp-eingabe', component: TippEingabeComponent },
      { path: '', redirectTo: 'ergebnisse', pathMatch: 'full' }
    ]
  }
];
