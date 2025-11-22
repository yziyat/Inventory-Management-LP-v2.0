import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { LoginComponent } from './components/login/login.component';
import { ArticlesComponent } from './components/articles/articles.component';
import { MovementsComponent } from './components/movements/movements.component';
import { StockComponent } from './components/stock/stock.component';
import { ReportsComponent } from './components/reports/reports.component';
import { UsersComponent } from './components/users/users.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Login' },
  { 
    path: '', 
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'stock', pathMatch: 'full' },
      { path: 'articles', component: ArticlesComponent, title: 'Articles' },
      { path: 'movements', component: MovementsComponent, title: 'Movements' },
      { path: 'stock', component: StockComponent, title: 'Current Stock' },
      { path: 'reports', component: ReportsComponent, title: 'Reports' },
      { path: 'users', component: UsersComponent, title: 'Users', canActivate: [adminGuard] },
      { path: 'settings', component: SettingsComponent, title: 'Settings', canActivate: [adminGuard] },
      { path: '**', redirectTo: 'stock' }
    ]
  },
];