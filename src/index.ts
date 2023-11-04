import * as xml2js from 'xml2js';
import * as nodemailer from 'nodemailer';
import _ from 'lodash';
import puppeteer from 'puppeteer';
import launch, { Puppeteer } from 'lighthouse';
import fs from 'fs';

// Variáveis de definição----------------------------------------
const sitemapPath = './src/sitemap.xml';
let pages = 10;
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'email',
    pass: 'senha especial'
  }
});

const mailOptions = {
  from: 'email envio',
  to: 'email recebimento',
  subject: '',
  text: '',
  html: '',
  attachments: [{
    filename: '',
    path: '',
    cid: ''
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
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const info = await transporter.sendMail(mailOptions);

      if(info) {
        console.log(`Email enviado: ${info.messageId}`);
        return info;
      } 
    } catch(error) {
      throw new Error(`Erro ao enviar email:\n ${error}`);
    }
    retries ++;
  }
}

async function captureScreenshot(page: Puppeteer.Page, url: string): Promise<string> {
  await page.setViewport({ width: 1920, height: 1080 });
  const screenshotPath = `./screenshot_${Date.now()}.png`;
  await page.goto(url);
  await page.screenshot({ path: screenshotPath, 
    type: 'jpeg',
    quality: 70,
    clip: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    },
  omitBackground: true,
});
  return screenshotPath;
}

async function captureMobileScreenshot(page: Puppeteer.Page, url: string): Promise<string> {
  await page.setViewport({ width: 360, height: 640 });
  const screenshotPath = `./screenshot_mobile_${Date.now()}.png`;
  await page.goto(url);
  await page.screenshot({ path: screenshotPath, 
    type: 'jpeg',
    quality: 100,
    clip: {
      x: 0,
      y: 0,
      width: 360,
      height: 640
    },
  omitBackground: true,
});
  return screenshotPath;
}

async function runLighthouseWithRetry(url, lighthouseConfig) {
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries){
    try {
      const report = await launch(url, lighthouseConfig);

      if(report.lhr.categories.performance.score){
        return report;
      } 
    } catch(errorLighthouse){
      console.log(`Erro ao executar lighthouse: ${errorLighthouse.messageId}`)
    }
    retries ++;
  }
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const lighthouseInfos = [];
  const screenshotPaths = [];

  const lighthouseConfig: any = {
    output: 'json',
    port: (new URL(browser.wsEndpoint())).port,
    settings: {
      emulatedFormFactor: 'desktop'
    }
  };

  const lighthouseConfigMobile: any = {
    output: 'json',
    port: (new URL(browser.wsEndpoint())).port,
    settings: {
      emulatedFormFactor: 'mobile'
    }
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
        let report = await runLighthouseWithRetry(url, lighthouseConfig);
        let reportMobile = await runLighthouseWithRetry(url, lighthouseConfigMobile);

        if (report && reportMobile){
          const screenshotPath = await captureScreenshot(page, url);
          screenshotPaths.push(screenshotPath);

          lighthouseInfos.push(`
            <p>Página analisada: ${url}</p>

            <p>Performance: ${Math.round(report.lhr.categories.performance.score * 100)}%</p>
            <p>Acessibilidade: ${Math.round(report.lhr.categories.accessibility.score * 100)}%</p>
            <p>Boas práticas: ${Math.round(report.lhr.categories['best-practices'].score * 100)}%</p>
            <p>SEO: ${Math.round(report.lhr.categories.seo.score * 100)}%</p>

            <p>FCP: ${Math.round(report.lhr.audits['first-contentful-paint'].numericValue)}ms</p>
            <p>LCP: ${Math.round(report.lhr.audits['largest-contentful-paint'].numericValue)}ms</p>
            <p>TBT: ${Math.round(report.lhr.audits['total-blocking-time'].numericValue)}ms</p>
            <p>CLS: ${Math.round(report.lhr.audits['cumulative-layout-shift'].numericValue)}</p>
            <p>Speed Index: ${Math.round(report.lhr.audits['speed-index'].numericValue)}</p>
          `);

          performance += report.lhr.categories.performance.score*100;
          accessibility += report.lhr.categories.accessibility.score * 100;
          bestPractices+= report.lhr.categories['best-practices'].score * 100;
          seo += report.lhr.categories.seo.score * 100;
          fcp += report.lhr.audits['first-contentful-paint'].numericValue;
          lcp += report.lhr.audits['largest-contentful-paint'].numericValue;
          tbt += report.lhr.audits['total-blocking-time'].numericValue;
          cls += report.lhr.audits['cumulative-layout-shift'].numericValue;
          speedIndex += report.lhr.audits['speed-index'].numericValue;


          const screenshotPathMobile = await captureMobileScreenshot(page, url);
          screenshotPaths.push(screenshotPathMobile);

          lighthouseInfos.push(`
            <p>Página analisada: ${url}</p>

            <p>Performance: ${Math.round(reportMobile.lhr.categories.performance.score * 100)}%</p>
            <p>Acessibilidade: ${Math.round(reportMobile.lhr.categories.accessibility.score * 100)}%</p>
            <p>Boas práticas: ${Math.round(reportMobile.lhr.categories['best-practices'].score * 100)}%</p>
            <p>SEO: ${Math.round(reportMobile.lhr.categories.seo.score * 100)}%</p>

            <p>FCP: ${Math.round(reportMobile.lhr.audits['first-contentful-paint'].numericValue)}ms</p>
            <p>LCP: ${Math.round(reportMobile.lhr.audits['largest-contentful-paint'].numericValue)}ms</p>
            <p>TBT: ${Math.round(reportMobile.lhr.audits['total-blocking-time'].numericValue)}ms</p>
            <p>CLS: ${Math.round(reportMobile.lhr.audits['cumulative-layout-shift'].numericValue)}</p>
            <p>Speed Index: ${Math.round(reportMobile.lhr.audits['speed-index'].numericValue)}</p>
          `);

          performance += reportMobile.lhr.categories.performance.score*100;
          accessibility += reportMobile.lhr.categories.accessibility.score * 100;
          bestPractices+= reportMobile.lhr.categories['best-practices'].score * 100;
          seo += reportMobile.lhr.categories.seo.score * 100;
          fcp += reportMobile.lhr.audits['first-contentful-paint'].numericValue;
          lcp += reportMobile.lhr.audits['largest-contentful-paint'].numericValue;
          tbt += reportMobile.lhr.audits['total-blocking-time'].numericValue;
          cls += reportMobile.lhr.audits['cumulative-layout-shift'].numericValue;
          speedIndex += reportMobile.lhr.audits['speed-index'].numericValue;
        } else {
          console.error(`Falha ao obter relatório para a URL: ${url}`)
        }
  
      } catch(errorLighthouse) {
        throw new Error(errorLighthouse);
      }
    }

    pages = pages*2;

    mailOptions.html += `
      <h2>Média geral de métricas</h2>
      <ul>
        <li>Performance geral: ${Math.round(performance)/pages}%</li>
        <li>Acessibilidade geral: ${Math.round(accessibility)/pages}%</li>
        <li>Boas práticas geral: ${Math.round(bestPractices)/pages}%</li>
        <li>SEO geral: ${Math.round(seo)/pages}%</li>
        <li>FCP geral: ${Math.round(fcp/pages)}ms</li>
        <li>LCP geral: ${Math.round(lcp/pages)}ms</li>
        <li>TBT geral: ${Math.round(tbt/pages)}ms</li>
        <li>CLS geral: ${Math.round(cls/pages)}</li>
        <li>Speed-index geral: ${Math.round(speedIndex)/pages}</li>
      </ul>  

      <h2>Páginas analisadas</h2>
      <table style='width:100%'>
        <tr>
          <th style='width:60%'>Screenshot</th>
          <th style='width:40%'>Dados Lighthouse</th>
        </tr>
    `;
    screenshotPaths.forEach((screenshotPath, index) => {
      mailOptions.html += `
          <tr>
            <td style='text-align:center; width:60%; margin:5%;'><img style='width:auto; max-width:80%; height:auto; max-height:350px;' src="cid:screenshot_${index}"></td>
            <td style='width:40%'>${lighthouseInfos[index]}</td>
          </tr>
      `
    });
    mailOptions.html += `</table>`
    
    mailOptions.subject = 'Relatório Cron-Lighthouse';
    mailOptions.text = 'Relatório com médias lighthouse do site teky';
    mailOptions.attachments = screenshotPaths.map((screenshotPath, index) => ({
      filename: `screenshot_${index}.png`,
      path: screenshotPath,
      cid: `screenshot_${index}`
    }));
    await sendMail();

    console.log('Processo Finalizado')
    await browser.close();
  } catch(error) {
    mailOptions.subject = 'Erro ao executar Cron-Lighthouse';
    mailOptions.text = `Erro na execução cron lighthouse\n ${error}`;
    mailOptions.html = '';
    mailOptions.attachments = [{
      filename: '',
      path: '',
      cid: ''
    }];
    await sendMail();
    
    throw new Error(error);
  }
})();
