
import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {StorageService} from './services/storage.service';
import {filter} from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {

  gildenName = 'NWA';

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {

      let currentRoute = this.route;

      // bis zur tiefsten aktiven Route gehen
      while (currentRoute.firstChild) {
        currentRoute = currentRoute.firstChild;
      }

      const name = currentRoute.snapshot.paramMap.get('name');

      if (name) {
        this.gildenName = name;
      }
    });
  }
}
