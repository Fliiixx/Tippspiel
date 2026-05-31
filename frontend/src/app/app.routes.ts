import { Routes } from '@angular/router';
import { TippEingabeComponent } from './tipp-eingabe/tipp-eingabe.component';
import { ErgebnisseComponent } from './ergebnisse/ergebnisse.component';

export const routes: Routes = [
  {
    path: 'gilde/:gildenname',
    children: [
      {
        path: 'saison/:saison/runde/:runde',
        component: ErgebnisseComponent
      },
      {
        path: 'saison/:saison',
        component: ErgebnisseComponent
      },
      {
        path: 'saison',
        component: ErgebnisseComponent
      },
      { path: 'tipp-eingabe', component: TippEingabeComponent },
      { path: '', redirectTo: 'saison', pathMatch: 'full' }
    ]
  },
  {
    path: 'gilde/:name',
    children: [
      { path: 'ergebnisse', component: ErgebnisseComponent },
      { path: 'tipp-eingabe', component: TippEingabeComponent },
      { path: '', redirectTo: 'ergebnisse', pathMatch: 'full' }
    ]
  }
];
