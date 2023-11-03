import * as xml2js from 'xml2js';
import * as nodemailer from 'nodemailer';
import _ from 'lodash';
import puppeteer from 'puppeteer';
import launch, { Puppeteer } from 'lighthouse';
import fs from 'fs';

// Variáveis de definição----------------------------------------
const sitemapPath = './src/sitemap.xml';
const pages = 1;
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'contato.moisessantanna@gmail.com',
    pass: 'mhyn jnll manw ufls'
  }
});

const mailOptions = {
  from: 'contato.moisessantanna@gmail.com',
  to: 'moisespsantanna@gmail.com',
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
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email enviado: ${info.messageId}`);
  } catch(error) {
    throw new Error(`Erro ao enviar email:\n ${error}`);
  }
}

async function captureScreenshot(page: Puppeteer.Page, url: string): Promise<string> {
  const screenshotPath = `./screenshot_${Date.now()}.png`;
  await page.goto(url);
  await page.screenshot({ path: screenshotPath });
  return screenshotPath;
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const lighthouseInfos = [];
  const screenshotPaths = [];

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

        const screenshotPath = await captureScreenshot(page, url);
        screenshotPaths.push(screenshotPath);

        lighthouseInfos.push(`
          <p>Página analisada: https://www.teky.com.br/646a5b3ed496504d21e054ed/eixo-prolongador-1m-para-chave-903500,https://www.teky.com.br/646a5962d496504d21dd98ff/contator-principal-400a-s12-220-240v-3rt10-75-siemens</p>

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
  
      } catch(errorLighthouse) {
        throw new Error(errorLighthouse);
      }
    }


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
          <th>Screenshot</th>
          <th>Dados Lighthouse</th>
        </tr>
    `;
    screenshotPaths.forEach((screenshotPath, index) => {
      mailOptions.html += `
          <tr>
            <td><img style='width:100%; height:auto;' src="cid:screenshot_${index}"></td>
            <td>${lighthouseInfos[index]}</td>
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
    mailOptions.attachments = [{
      filename: '',
      path: '',
      cid: ''
    }];
    await sendMail();
    
    throw new Error(error);
  }
})();
