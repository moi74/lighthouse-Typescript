import puppeteer from 'puppeteer';
import launch from 'lighthouse';
import fs from 'fs';

(async () => {
  // Inicialize o Puppeteer
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage();

  const url = 'https://www.mercadolivre.com.br/monitor-dell-27-s2721hn/p/MLB23417008';

  // Execute o Lighthouse usando o Chrome já iniciado pelo Puppeteer
  const lighthouseConfig: any = {
    output: 'json',
    port: (new URL(browser.wsEndpoint())).port,
  };

  const report = await launch(url, lighthouseConfig);

  const performanceMetrics = report.lhr.categories.performance.auditRefs;

  let metricStrings = '';

  performanceMetrics.forEach(metric => {
    const metricName = metric.id;
    const metricValue = report.lhr.audits[metricName].numericValue;
    metricStrings += `Métrica: ${metricName}, Valor: ${metricValue}\n`;
  });

  console.log(`Performance: ${report.lhr.categories.performance.score * 100}`);
  console.log(`Acessibilidade: ${report.lhr.categories.accessibility.score * 100}`);
  console.log(`Boas práticas: ${report.lhr.categories['best-practices'].score * 100}`);
  console.log(`SEO: ${report.lhr.categories.seo.score * 100}`);

  metricStrings += `\nPerformance: ${report.lhr.categories.performance.score * 100}\n`;
  metricStrings += `Acessibilidade: ${report.lhr.categories.accessibility.score * 100}\n`;
  metricStrings += `Boas práticas: ${report.lhr.categories['best-practices'].score * 100}\n`;
  metricStrings += `SEO: ${report.lhr.categories.seo.score * 100}\n`;


  fs.writeFileSync('performDetails.txt', metricStrings, 'utf-8');
  await browser.close();
})();
