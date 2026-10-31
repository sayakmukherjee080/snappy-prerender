import 'zone.js';
import '@angular/compiler';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

/**
 * Hosts the framework-agnostic site controller and renders its HTML through Angular.
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
  standalone: true,
  template: '',
})(AppComponent);

bootstrapApplication(AppComponent).catch((error) => console.error(error));
