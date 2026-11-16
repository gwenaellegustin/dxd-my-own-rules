import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { LanguageService } from '../../core/services/language.service';
import { MainNav } from '../main-nav/main-nav';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-header',
  imports: [UpperCasePipe, RouterLink, TranslatePipe, Icon, MainNav],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeMenuOnOutsideClick($event)',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
})
export class AppHeader {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly user = inject(UserService);
  protected readonly language = inject(LanguageService);

  protected readonly menuOpen = signal(false);

  protected closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }
}
