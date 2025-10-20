import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: '../../../../angular-iceforge/src/app/app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'angular-iceforge';
}
