import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Movement } from '../../models/movement.model';
import { TranslationService } from '../../services/translation.service';
import { ExportService } from '../../services/export.service';
import { CustomDatePipe } from '../../pipes/custom-date.pipe';
import { NotificationService } from '../../services/notification.service';

interface DetailedReportRow {
  articleId: number;
  articleName: string;
  articleCode: string;
  stockInitial: number;
  totalIn: number;
  totalOut: number;
  stockFinal: number;
  destinations: { [key: string]: number };
}

interface OutgoingAnalysisRow {
    destination: string;
    totalQuantity: number;
    totalValue: number;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CustomDatePipe],
})
export class ReportsComponent {
  private apiService = inject(ApiService);
  // FIX: Add explicit type to injected FormBuilder.
  private fb: FormBuilder = inject(FormBuilder);
  private translationService = inject(TranslationService);
  private exportService = inject(ExportService);
  private notificationService = inject(NotificationService);
  t = this.translationService.currentTranslations;

  articles = this.apiService.articles;
  reportData = signal<DetailedReportRow[] | null>(null);
  outgoingAnalysisData = signal<OutgoingAnalysisRow[] | null>(null);
  
  filterForm = this.fb.group({
    startDate: [this.getFirstDayOfMonth(), Validators.required],
    endDate: [this.getLastDayOfMonth(), Validators.required],
    articleId: ['']
  });

  reportDestinations = computed(() => {
    return this.apiService.settings().destinations;
  });

  constructor() {
    this.generateReport();
  }

  private getFirstDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  private getLastDayOfMonth(): string {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  generateReport() {
    if (this.filterForm.invalid) return;
    this.outgoingAnalysisData.set(null); // Reset other report

    const { startDate, endDate, articleId } = this.filterForm.value;
    const allMovements = this.apiService.movements();
    const allArticles = this.apiService.articles();
    const destinations = this.reportDestinations();

    const selectedArticleId = articleId ? Number(articleId) : null;
    
    const filteredArticles = selectedArticleId
      ? allArticles.filter(a => a.id === selectedArticleId)
      : allArticles;


    const report: DetailedReportRow[] = filteredArticles.map(article => {
      const articleMovements = allMovements.filter(m => m.articleId === article.id);

      const stockInitial = articleMovements
        .filter(m => m.date < startDate!)
        .reduce((acc, m) => acc + this.getSignedQuantity(m), 0);

      const movementsInPeriod = articleMovements.filter(m => m.date >= startDate! && m.date <= endDate!);

      const totalIn = movementsInPeriod
        .filter(m => m.type === 'Entrée' || m.type === 'Ajustement')
        .reduce((sum, m) => sum + m.quantity, 0);

      const totalOut = movementsInPeriod
        .filter(m => m.type === 'Sortie' || m.type === 'Périmé / Rebut')
        .reduce((sum, m) => sum + m.quantity, 0);

      const destinationBreakdown: { [key: string]: number } = {};
      destinations.forEach(dest => {
        destinationBreakdown[dest] = movementsInPeriod
          .filter(m => (m.type === 'Sortie' || m.type === 'Périmé / Rebut') && m.supplierDest === dest)
          .reduce((sum, m) => sum + m.quantity, 0);
      });

      const stockFinal = stockInitial + totalIn - totalOut;
      
      return {
        articleId: article.id,
        articleName: article.name,
        articleCode: article.code,
        stockInitial,
        totalIn,
        totalOut,
        stockFinal,
        destinations: destinationBreakdown,
      };
    });
    
    report.sort((a,b) => a.articleName.localeCompare(b.articleName));
    this.reportData.set(report);
  }

  generateOutgoingAnalysis() {
    if (this.filterForm.invalid) return;

    const { startDate, endDate, articleId } = this.filterForm.value;
    const allMovements = this.apiService.movements();
    const allArticles = this.apiService.articles();

    const selectedArticleId = articleId ? Number(articleId) : null;

    const movementsInPeriod = allMovements.filter(m => 
      m.date >= startDate! && m.date <= endDate! &&
      (m.type === 'Sortie' || m.type === 'Périmé / Rebut') &&
      (!selectedArticleId || m.articleId === selectedArticleId)
    );

    const analysisMap = new Map<string, { quantity: number, value: number }>();

    movementsInPeriod.forEach(m => {
        const article = allArticles.find(a => a.id === m.articleId);
        if (article && m.supplierDest) {
            const current = analysisMap.get(m.supplierDest) || { quantity: 0, value: 0 };
            current.quantity += m.quantity;
            current.value += m.quantity * article.price;
            analysisMap.set(m.supplierDest, current);
        }
    });

    const analysisResult: OutgoingAnalysisRow[] = [];
    analysisMap.forEach((data, destination) => {
        analysisResult.push({
            destination,
            totalQuantity: data.quantity,
            totalValue: data.value
        });
    });
    
    analysisResult.sort((a,b) => b.totalValue - a.totalValue);
    this.outgoingAnalysisData.set(analysisResult);
  }

  private getSignedQuantity(movement: Movement): number {
    if (movement.type === 'Entrée' || movement.type === 'Ajustement') {
      return movement.quantity;
    }
    return -movement.quantity;
  }

  resetFilters() {
    this.filterForm.reset({ 
      startDate: this.getFirstDayOfMonth(), 
      endDate: this.getLastDayOfMonth(), 
      articleId: '' 
    });
    this.generateReport();
  }

  exportToExcel() {
    const mainReport = this.reportData();
    const outgoingReport = this.outgoingAnalysisData();

    if (mainReport && mainReport.length > 0) {
      this.exportMainReport(mainReport);
    } else if (outgoingReport && outgoingReport.length > 0) {
      this.exportOutgoingReport(outgoingReport);
    } else {
      this.notificationService.showWarning(this.translationService.translate('common.noDataToExport'));
    }
  }

  private exportMainReport(data: DetailedReportRow[]) {
     const destinations = this.reportDestinations();
     const t = this.t();
     const dataToExport = data.map(row => {
        const exportedRow: any = {
            [t.reports.table.article]: row.articleName,
            [t.reports.table.code]: row.articleCode,
            [t.reports.table.initialStock]: row.stockInitial,
            [t.reports.table.totalIn]: row.totalIn,
        };
        destinations.forEach(dest => {
            exportedRow[dest] = row.destinations[dest] || 0;
        });
        exportedRow[t.reports.table.totalOut] = row.totalOut;
        exportedRow[t.reports.table.finalStock] = row.stockFinal;
        return exportedRow;
    });
    this.exportService.exportToExcel(dataToExport, 'Report_Stock_Movement');
  }

  private exportOutgoingReport(data: OutgoingAnalysisRow[]) {
    const t = this.t();
    const dataToExport = data.map(row => ({
      [t.reports.outgoingAnalysis.destination]: row.destination,
      [t.reports.outgoingAnalysis.totalQuantity]: row.totalQuantity,
      [t.reports.outgoingAnalysis.totalValue]: row.totalValue,
    }));
    this.exportService.exportToExcel(dataToExport, 'Report_Outgoing_Analysis');
  }
}
