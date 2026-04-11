const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: "new"
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:14141');
  await page.click('[data-section="sec-settings"]');
  await page.waitForTimeout(1000);
  
  const content = await page.evaluate(() => {
    return {
      settingsDisplay: getComputedStyle(document.getElementById('sec-settings')).display,
      homeDisplay: getComputedStyle(document.getElementById('sec-home')).display,
      planDisplay: getComputedStyle(document.getElementById('meal-planned-list')).display,
      planParent: document.getElementById('meal-planned-list').parentElement.id
    };
  });
  console.log(content);
  await browser.close();
})();
