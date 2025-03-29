const puppeteer = require("puppeteer");
const fs = require("fs");

(async () => {
    // Launch the browser
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Navigate to the target URL
    const url = "https://www.espncricinfo.com/records/tournament/team-match-results/icc-men-s-t20-world-cup-2022-23-14450";
    console.log(`🔍 Navigating to ${url}`);
    
    await page.goto(url, {
        waitUntil: "networkidle2", // Ensures the page is fully loaded
        timeout: 0
    });

    // Wait for table rows to load
    await page.waitForSelector("table tbody tr");

    console.log("📌 Extracting match summary...");
    const matchSummary = await page.evaluate(() => {
        const matches = [];
        const rows = document.querySelectorAll("table tbody tr"); // Select all table rows

        rows.forEach(row => {
            const tds = row.querySelectorAll("td"); // Select the table cells
            const getText = (td) => td ? td.innerText.trim() : "N/A";

            if (tds.length >= 7) { // Ensure the row has enough columns
                matches.push({
                    "team1": getText(tds[0]),
                    "team2": getText(tds[1]),
                    "winner": getText(tds[2]),
                    "margin": getText(tds[3]),
                    "ground": getText(tds[4]),
                    "matchDate": getText(tds[5]),
                    "scorecard": getText(tds[6]) // Extract Match Number (e.g., "T20I # 1823")
                });
            }
        });

        return matches;
    });

    // Save data to a JSON file
    const filePath = "match_summary.json";
    fs.writeFileSync(filePath, JSON.stringify(matchSummary, null, 2), "utf-8");
    console.log(`✅ Match data saved successfully to ${filePath}!`);

    // Close the browser
    await browser.close();
})();
