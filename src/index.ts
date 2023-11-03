import * as xml2js from 'xml2js';
import * as nodemailer from 'nodemailer';
import _ from 'lodash';
import puppeteer from 'puppeteer';
import launch from 'lighthouse';
import fs from 'fs';

// Variáveis de definição----------------------------------------
const sitemapPath = './src/sitemap.xml';
const pages = 1;
const transporter = nodemailer.createTransport({
  host: 'provedor-email',
  port: 465,
  secure: true,
  auth: {
    user: 'email',
    pass: 'senha'
  }
});

const mailOptions = {
  from: 'email envio',
  to: 'email recebimento',
  subject: '',
  text: '',
  attachments: [{
    filename: '',
    path: ''
  }]  
} 

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
            const urls = result.urlset.url.map((urlItem: any) => urlItem.loc[0]);
            resolve(urls);
          }
        });
      }
    });
  });
}

function chooseRandomPages(urls: string[]): string[] {
  return _.sampleSize(urls, pages);
}

async function sendMail() {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email enviado: ${info.messageId}`);
  } catch(error) {
    throw new Error(`Erro ao enviar email:\n ${error}`);
  }
}

(async () => {
  let metricStrings = '';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const lighthouseConfig: any = {
    output: 'json',
    port: (new URL(browser.wsEndpoint())).port,
  };

  try {
    const urls = await readSiteMap(sitemapPath);
    const randomPages = chooseRandomPages(urls);

    let performance = 0;
    let accessibility = 0;
    let bestPractices =0;
    let seo = 0;
    let fcp = 0;
    let lcp = 0;
    let tbt = 0;
    let cls = 0;
    let speedIndex = 0;

    for (const url of randomPages) {
      try {
        let report = await launch(url, lighthouseConfig);

        metricStrings += `Página analisada: ${randomPages}\n`;
  
        metricStrings += `\nPerformance: ${Math.round(report.lhr.categories.performance.score * 100)}\n`;
        performance += report.lhr.categories.performance.score*100;

        metricStrings += `Acessibilidade: ${Math.round(report.lhr.categories.accessibility.score * 100)}\n`;
        accessibility += report.lhr.categories.accessibility.score * 100;

        metricStrings += `Boas práticas: ${Math.round(report.lhr.categories['best-practices'].score * 100)}\n`;
        bestPractices+= report.lhr.categories['best-practices'].score * 100;

        metricStrings += `SEO: ${Math.round(report.lhr.categories.seo.score * 100)}\n`;
        seo += report.lhr.categories.seo.score * 100;
    
        metricStrings += `\nFCP: ${Math.round(report.lhr.audits['first-contentful-paint'].numericValue)}ms\n`;
        fcp += report.lhr.audits['first-contentful-paint'].numericValue;

        metricStrings += `LCP: ${Math.round(report.lhr.audits['largest-contentful-paint'].numericValue)}ms\n`;
        lcp += report.lhr.audits['largest-contentful-paint'].numericValue;

        metricStrings += `TBT: ${Math.round(report.lhr.audits['total-blocking-time'].numericValue)}ms\n`;
        tbt += report.lhr.audits['total-blocking-time'].numericValue;

        metricStrings += `CLS: ${Math.round(report.lhr.audits['cumulative-layout-shift'].numericValue)}\n`;
        cls += report.lhr.audits['cumulative-layout-shift'].numericValue;

        metricStrings += `Speed Index: ${Math.round(report.lhr.audits['speed-index'].numericValue)}\n`;
        speedIndex += report.lhr.audits['speed-index'].numericValue;
        metricStrings += `\n---------------------------------------------------------------\n`;
  
      } catch(errorLighthouse) {
        throw new Error(errorLighthouse);
      }
    }

    metricStrings += `Performance geral: ${Math.round(performance)/pages}\n`
    metricStrings += `Acessibilidade geral: ${Math.round(accessibility)/pages}\n`;
    metricStrings += `Boas práticas geral: ${Math.round(bestPractices)/pages}\n`;
    metricStrings += `SEO geral: ${Math.round(seo)/pages}\n`;
    metricStrings += `\nFCP geral: ${Math.round(fcp/pages)}ms\n`;
    metricStrings += `LCP geral: ${Math.round(lcp/pages)}ms\n`;
    metricStrings += `TBT geral: ${Math.round(tbt/pages)}ms\n`;
    metricStrings += `CLS geral: ${Math.round(cls/pages)}\n`;
    metricStrings += `Speed-index geral: ${Math.round(speedIndex)/pages}\n`;

    fs.writeFileSync('./performDetails.txt', metricStrings, 'utf-8');
    
    mailOptions.subject = 'Relatório Cron-Lighthouse';
    mailOptions.text = 'Relatório com médias lighthouse do site teky';
    mailOptions.attachments = [{
      filename: 'Relatório lighthouse.txt',
      path: './performDetails.txt'
    }];
    await sendMail();

    console.log('Processo Finalizado')
    await browser.close();
  } catch(error) {
    mailOptions.subject = 'Erro ao executar Cron-Lighthouse';
    mailOptions.text = `Erro na execução cron lighthouse\n ${error}`;
    await sendMail();
    
    throw new Error(error);
  }
})();
