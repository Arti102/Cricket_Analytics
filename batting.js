const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    // Launch the browser
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to the target URL
    await page.goto('https://www.espncricinfo.com/records/tournament/team-match-results/icc-men-s-t20-world-cup-2022-23-14450', {
        waitUntil: 'networkidle2',
        timeout: 0
    });

    // Extract match summary links
    const matchLinks = await page.evaluate(() => {
        let links = [];
        document.querySelectorAll('table tbody tr').forEach(row => {
            const anchor = row.querySelectorAll('td a');
            if (anchor.length > 0) {
                let rowURL = "https://www.espncricinfo.com" + anchor[anchor.length - 1].getAttribute('href');
                links.push(rowURL);
            }
        });
        return links;
    });

    console.log(`✅ Found ${matchLinks.length} match links.`);

    let battingSummary = [];

    for (let url of matchLinks) {
        console.log(`🔍 Scraping data from: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

        let matchData = await page.evaluate(() => {
            const getText = (element) => element ? element.innerText.trim() : 'N/A';

            // Get team names from the scorecard
            let teamElements = document.querySelectorAll('.ds-text-title-xs.ds-font-bold.ds-capitalize');
            let teams = Array.from(teamElements).map(el => el.innerText.trim());

            if (teams.length < 2) return null;
            let team1 = teams[0], team2 = teams[1];
            let matchInfo = `${team1} Vs ${team2}`;

            // Select batting tables
            let tables = document.querySelectorAll('table.ds-w-full.ds-table');
            if (tables.length < 2) return null; // Ensure there are at least two innings

            let extractBattingData = (table, team) => {
                let rows = Array.from(table.querySelectorAll('tbody tr'))
                    .filter(row => row.querySelectorAll('td').length >= 8);

                return rows.map((row, index) => {
                    let tds = row.querySelectorAll('td');
                    return {
                        "match": matchInfo,
                        "teamInnings": team,
                        "battingPos": index + 1,
                        "batsmanName": getText(tds[0].querySelector('a') || tds[0]),
                        "dismissal": getText(tds[1]),
                        "runs": getText(tds[2]),
                        "balls": getText(tds[3]),
                        "4s": getText(tds[5]),
                        "6s": getText(tds[6]),
                        "SR": getText(tds[7])
                    };
                });
            };

            return [
                ...extractBattingData(tables[0], team1),
                ...extractBattingData(tables[1], team2)
            ];
        });

        if (matchData) {
            battingSummary.push(...matchData);
        }
    }

    // Save data to JSON file
    fs.writeFileSync('batting.json', JSON.stringify(battingSummary, null, 2), 'utf-8');
    console.log('✅ Data saved successfully to batting.json!');

    await browser.close();
})();
