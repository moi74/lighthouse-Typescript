import * as xml2js from 'xml2js';
import _ from 'lodash'; // Import Lodash
import puppeteer from 'puppeteer';
import launch from 'lighthouse';
import fs from 'fs';

function readSiteMap(sitemapPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readFile(sitemapPath, 'utf-8',(err, data) => {
      if(err){
        reject(err);
      } else {
        xml2js.parseString(data, (parseErr, result) => {
          if(parseErr) {
            reject(parseErr);
          } else {
            console.log('sitemap lido');
            const urls = result.urlset.url.map((urlItem: any) => urlItem.loc[0]);
            resolve(urls);
          }
        });
      }
    });
  });
}

function chooseRandomPages(urls: string[]): string[] {
  console.log('Escolhendo páginas aleatórias');
  return _.sampleSize(urls, 1);
}

const sitemapPath = './src/sitemap.xml';

(async () => {
  let metricStrings = '';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const url = 'https://www.mercadolivre.com.br/monitor-dell-27-s2721hn/p/MLB23417008';

  // Execute o Lighthouse usando o Chrome já iniciado pelo Puppeteer
  const lighthouseConfig: any = {
    output: 'json',
    port: (new URL(browser.wsEndpoint())).port,
  };

  try {
    const urls = await readSiteMap(sitemapPath);
    const randomPages = chooseRandomPages(urls);

    console.log('Páginas aleatórias:');
    randomPages.forEach((page, index) => {
      console.log(`${index + 1}: ${page}`);
    });

    console.log('Iniciando leitura de páginas lighthouse')
    const report = await launch(url, lighthouseConfig);
    const performanceMetrics = report.lhr.categories.performance.auditRefs;
    console.log('Concluída leitura lighthouse');


    console.log('Preenchendo variável de arquivo')
    metricStrings += randomPages;
    performanceMetrics.forEach(metric => {
      const metricName = metric.id;
      const metricValue = report.lhr.audits[metricName].numericValue;
      metricStrings += `Métrica: ${metricName}, Valor: ${metricValue}\n`;
    });

    metricStrings += `\nPerformance: ${report.lhr.categories.performance.score * 100}\n`;
    metricStrings += `Acessibilidade: ${report.lhr.categories.accessibility.score * 100}\n`;
    metricStrings += `Boas práticas: ${report.lhr.categories['best-practices'].score * 100}\n`;
    metricStrings += `SEO: ${report.lhr.categories.seo.score * 100}\n`;


    fs.writeFileSync('performDetails.txt', metricStrings, 'utf-8');
    await browser.close();
  } catch(error) {
    throw new Error(error);
  }
})();
