import 'zone.js/dist/zone';
import '@angular/compiler';
import { Component, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Hosts the shared site controller and renders its HTML through Angular 10.
 */
class AppComponent {
  ngAfterViewInit() {
    const root = document.querySelector('app-root');
    const site = createSiteApp({
      async renderHtml(value) {
        root.innerHTML = value;
      },
      mountIslands,
      getRoot: () => root,
    });
    site.start();
  }
}

// biome-ignore lint/suspicious/noClassAssign: plain JavaScript applies the Angular decorator after the class definition.
AppComponent = Component({
  selector: 'app-root',
  template: '',
})(AppComponent);

class AppModule {}

// biome-ignore lint/suspicious/noClassAssign: plain JavaScript applies the Angular decorator after the class definition.
AppModule = NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  bootstrap: [AppComponent],
})(AppModule);

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((error) => console.error(error));
