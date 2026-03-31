const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const APP_NAME = process.argv[2] || 'FxCRM Import Tool (Auto)';
const FX_LOGIN_URL = 'https://www.fxiaoke.com/xv/home/index.html'; // Entry point

(async () => {
    console.log('🚀 Launching Browser for FxCRM Automation...');
    console.log(`📋 Target App Name: "${APP_NAME}"`);

    const browser = await puppeteer.launch({
        headless: false, // Must be visible for manual login
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // 1. Navigate to Login
    console.log('👉 Navigating to FxCRM... Please Login Manually!');
    await page.goto(FX_LOGIN_URL);

    // 2. Wait for user to login and reach the dashboard
    // We detect login by checking for a common element in the dashboard, e.g., the visible sidebar or header
    // Adjust selector as needed based on actual FxCRM DOM
    try {
        await page.waitForFunction(() => {
            return window.location.href.includes('/home') && document.body.innerText.includes('工作台');
        }, { timeout: 300000 }); // Wait up to 5 mins for login
    } catch (e) {
        console.error('❌ Login timeout. Please try again.');
        await browser.close();
        return;
    }

    console.log('✅ Login Detected!');

    // 3. Navigate to Self-built App Page
    // Note: The URL might need adjustment based on specific tenant ID or version.
    // For now, we guide the user or attempt direct navigation if URL is known.
    // Since FxCRM uses hash routing #/..., we might try to go there directly.
    // URL pattern typically: /#pl/system/integration/developer/selfBuiltApp
    // Let's ask user to navigate OR try to go there.

    console.log('👉 Please navigate to [管理后台] -> [系统集成] -> [开发平台] -> [自建应用].');
    console.log('⏳ Waiting for "新建应用" (Create Application) button to be visible...');

    // Wait for the "Create App" button or the App List page
    // Selector needs to be specific. Assuming a button text or class.
    // We'll wait for user navigation for now to be safe.

    // We will verify we are on the right page by looking for specific text
    await page.waitForFunction(() => {
        return document.body.innerText.includes('自建应用') || document.body.innerText.includes('新建应用');
    }, { timeout: 0 }); // Wait indefinitely

    console.log('✅ Detected "Self-built App" Page.');

    // 4. Click Create Button
    // We need to inspect the DOM to find the real selector. 
    // Since we don't have the source, we rely on text matching.
    const createBtnClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find(b => b.innerText.includes('新建应用'));
        if (target) {
            target.click();
            return true;
        }
        return false;
    });

    if (!createBtnClicked) {
        console.log('⚠️ Could not auto-click "新建应用". Please click it manually.');
    } else {
        console.log('🖱️ Clicked "新建应用".');
    }

    // 5. Fill Form
    // Wait for modal/form
    await new Promise(r => setTimeout(r, 2000)); // wait for animation

    console.log('✍️ Filling App Name...');
    // Try to find input for name. Often it's the first input in a modal.
    const filledParams = await page.evaluate((name) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        // Heuristic: First visible input in a dialog/modal
        const nameInput = inputs.find(i => {
            const style = window.getComputedStyle(i);
            return style.display !== 'none' && i.closest('.arco-modal-content, .el-dialog'); // common frameworks
        });

        if (nameInput) {
            nameInput.value = name;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            // Select "Enterprise Internal App" radio if exists
            // Heuristic: Radio button with label "企业内部应用"
            // This part is tricky without DOM. Let's stick to name.
            return true;
        }
        return false;
    }, APP_NAME);

    if (filledParams) {
        console.log('✅ Form filled. Please review and click "Save/Confirm".');
    } else {
        console.log('⚠️ Could not auto-fill form. Please enter App Name manually.');
    }

    // 6. Wait for Creation Success and Detail Page
    console.log('⏳ Waiting for App Details page (looking for AppID)...');

    // Polling for App ID in the DOM
    const credentials = await page.waitForFunction(() => {
        const bodyText = document.body.innerText;
        // Looking for patterns like "App ID: FSA..."
        // Or specific DOM elements
        // This is a naive scraper for now.
        const appIdMatch = bodyText.match(/App ID[\s\S]{0,100}(FSA\w+)/);
        const secretMatch = bodyText.match(/App Secret[\s\S]{0,100}(\w{32,})/);
        // Permanent code usually requires another click "View" or isn't shown immediately.

        if (appIdMatch && secretMatch) {
            return {
                appId: appIdMatch[1],
                appSecret: secretMatch[1]
            };
        }
        return null;
    }, { timeout: 0 });

    const creds = await credentials.jsonValue();
    console.log('🎉 Credentials Found!');
    console.log('------------------------------------------------');
    console.log(`App ID:     ${creds.appId}`);
    console.log(`App Secret: ${creds.appSecret}`);
    console.log('------------------------------------------------');

    // 7. Save to file
    const output = {
        name: APP_NAME,
        ...creds,
        note: "Permanent Code requires manual generation in 'Authorization Management' section."
    };

    fs.writeFileSync('fxcrm_creds.json', JSON.stringify(output, null, 2));
    console.log('💾 Saved to fxcrm_creds.json');
    console.log('⚠️ Don\'t forget to generate and copy the Permanent Code manually!');

    // Keep browser open for user to close or move on
    // await browser.close(); 
})();
