import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { LanguageService } from '../../core/services/language.service';
import { MainNav } from '../main-nav/main-nav';
import { Dropdown } from '../../shared/dropdown/dropdown';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-header',
  imports: [UpperCasePipe, RouterLink, TranslatePipe, Icon, MainNav, Dropdown],
  templateUrl: './app-header.html',
  styleUrl: './app-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeader {
  protected readonly user = inject(UserService);
  protected readonly language = inject(LanguageService);

}
