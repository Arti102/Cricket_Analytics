const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://stats.espncricinfo.com/ci/engine/records/team/match_results.html?id=14450;type=tournament', {
        waitUntil: 'networkidle2',
        timeout: 0
    });

    await page.waitForSelector('tbody');

    const matchLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('tbody tr a').forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href.includes('/full-scorecard')) {
                links.push('https://www.espncricinfo.com' + href);
            }
        });
        return [...new Set(links)];
    });

    console.log(`✅ Found ${matchLinks.length} match links.`);

    if (matchLinks.length === 0) {
        console.log("❌ No match links found. Check the selector.");
        await browser.close();
        return;
    }

    let bowlingSummary = [];

    for (let url of matchLinks) {
        console.log(`🔍 Scraping data from: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

            // Ensure tables are loaded before scraping
            await page.waitForSelector('table.ds-table', { timeout: 10000 });
            await page.waitForFunction(() => {
                const tables = document.querySelectorAll('table.ds-table');
                return tables.length > 0 && tables[0].querySelectorAll('tbody tr').length > 0;
            }, { timeout: 10000 });

            const matchData = await page.evaluate(() => {
                const getText = (element) => element ? element.innerText.trim() : 'N/A';

                // Extract Date (Fix: Remove extra text)
                const dateElement = document.querySelector('div.ds-text-tight-xs.ds-truncate.ds-text-typo-mid3');
                let matchDate = dateElement ? dateElement.innerText.trim() : 'Unknown Date';

                // Extract only date part (Regex fix)
                const dateMatch = matchDate.match(/(\w+\s\d{1,2},\s\d{4})/);
                matchDate = dateMatch ? dateMatch[0] : 'Unknown Date';

                // Extract Match Title
                const titleElement = document.querySelector('.ds-text-title-xs.ds-font-bold.ds-capitalize');
                const matchTitle = titleElement ? titleElement.innerText.trim() : "Unknown Match";

                // Extract Team Names
                const teamElements = document.querySelectorAll('.ds-flex.ds-items-center.ds-min-w-0.ds-mr-1');
                const team1 = teamElements[0] ? teamElements[0].innerText.trim() : 'N/A';
                const team2 = teamElements[1] ? teamElements[1].innerText.trim() : 'N/A';
                const matchInfo = `${team1} Vs ${team2}`;

                const tables = document.querySelectorAll('table.ds-table');

                const getBowlingRows = (tableIndex, bowlingTeam) => {
                    const summary = [];
                    const rows = tables[tableIndex]?.querySelectorAll('tbody tr') || [];

                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 11) {
                            summary.push({
                                match: matchInfo, 
                                date: matchDate,
                                bowlingTeam: bowlingTeam,
                                bowlerName: getText(cells[0]),
                                overs: getText(cells[1]),
                                maiden: getText(cells[2]),
                                runs: getText(cells[3]),
                                wickets: getText(cells[4]),
                                economy: getText(cells[5]),
                                "0s": getText(cells[6]),
                                "4s": getText(cells[7]),
                                "6s": getText(cells[8]),
                                wides: getText(cells[9]),
                                noBalls: getText(cells[10]),
                            });
                        }
                    });

                    return summary;
                };

                // Fix: Correctly assign the bowling teams
                const firstInningsBowling = getBowlingRows(0, team1); // Team 1 bowls first
                const secondInningsBowling = getBowlingRows(1, team2); // Team 2 bowls second

                return [...firstInningsBowling, ...secondInningsBowling];
            });

            if (matchData.length > 0) {
                bowlingSummary.push(...matchData);
            } else {
                console.log(`⚠️ No data found for ${url}`);
            }

        } catch (error) {
            console.error(`❌ Error scraping ${url}: ${error.message}`);
        }
    }

    if (bowlingSummary.length > 0) {
        fs.writeFileSync('bowling.json', JSON.stringify(bowlingSummary, null, 2), 'utf-8');
        console.log('✅ Data saved successfully to bowling.json');
    } else {
        console.log('❌ No data extracted. Check selectors or website structure.');
    }

    await browser.close();
})();
